import {processAll} from '../common';
import {FlightCalculator, StaticFlightCalculator} from '../core/calculator/FlightCalculator';
import {PlayerContext} from '../core/PlayerContext';
import {FlightEvent, ShardedEspionageReport} from '../report-types';
import {EspionageRepository, GalaxyRepository} from '../repository-types';
import {MissionType, sameCoordinates} from '../types';
import {ProcessedReport} from './Analyzer';
import {EspionageReportScrapper} from './EspionageReportScrapper';
import {GalaxyObserver} from './GalaxyObserver';
import {EventListLoader, Launcher} from './Mapper';
import {ReportProcessor} from './ReportProcessor';

export class AutoRaidImpl {
  state: any = {
    status: 'idle',
    nextResume: null,
    maxSlots: 0,
    activeSlots: null,
    minRaid: 10,
    rate: [1, 10, 5], // relative cost rate of resources
    harvestEspionage: false
  };

  private data: ProcessedReport[] = [];

  constructor(private context: PlayerContext,
              private launcher: Launcher,
              private eventLoader: EventListLoader,
              private espionageReportScrapper: EspionageReportScrapper,
              private galaxyObserver: GalaxyObserver,
              private espionageRepo: EspionageRepository,
              private galaxyRepo: GalaxyRepository,
              private processor: ReportProcessor,
              private flightCalculator: FlightCalculator = StaticFlightCalculator.DEFAULT) {
  }

  async continue(): Promise<void> {
    if (this.state.maxSlots <= 0) return;
    if (this.state.harvestEspionage)
      await this.checkSpyReports();
    if (!this.data.length)
      this.data = await this.reloadData() as ProcessedReport[];
    return this.performNextLaunches();
  }

  private async checkSpyReports(): Promise<void> {
    this.state.status = 'reading reports';
    let allReports = await this.espionageReportScrapper.loadAllReports();
    this.state.harvestEspionage = false;
    if (allReports.length)
      this.data = [];
  }

  private async reloadData(): Promise<(ShardedEspionageReport | undefined)[]> {
    this.state.status = 'checking galaxy info';
    let staleSystems = await this.galaxyRepo.findStaleSystemsWithTargets(3600 * 2) //TODO expose this setting somewhere
    if (staleSystems.length) {
      this.state.status = 'refreshing galaxy info';
      await this.galaxyObserver.observeAll(staleSystems, true, true);
    }
    this.state.status = 'picking inactive targets';
    let targets = await this.galaxyRepo.findInactiveTargets();
    this.state.status = 'fetching existing reports';
    return processAll(targets, async c => await this.espionageRepo.loadC(c) ?? {
      infoLevel: -1,
      coordinates: c
    } as ShardedEspionageReport, true);
  }

  private async performNextLaunches() {
    const researches = await this.context.getResearches();
    const bodies = await this.context.getBodies();
    this.state.status = 'rating reports';

    this.data.forEach(report => this.processor.processReport(report, researches, bodies, this.state.rate));

    this.data.sort((a, b) =>
        +(b.infoLevel < 0) - +(a.infoLevel < 0) || /*dummies first*/
        b.meta.rating! - a.meta.rating! ||
        a.meta.distance! - b.meta.distance!
    );

    this.state.status = 'fetching events';
    let events = await this.eventLoader.loadEvents();
    this.state.status = 'checking raids in progress';
    let raidEvents = await this.findRaidEvents(events);
    this.state.activeSlots = raidEvents.length;
    this.excludeActiveTargets(raidEvents); // TODO make possible to repeat on same target
    let missionsToGo = this.state.maxSlots - raidEvents.length;

    let targetsToSpy: ProcessedReport[] = [], targetsToLaunch: ProcessedReport[] = [];
    this.pickTargets(missionsToGo, targetsToSpy, targetsToLaunch);

    let spyTime = Infinity, raidTime = Infinity;
    if (targetsToSpy.length) {
      this.state.harvestEspionage = true;
      // pick longest espionage mission one-way flight
      spyTime = Math.max(0, ...targetsToSpy.map(target =>
          this.flightCalculator.flightTime(target.meta.distance!, this.flightCalculator.fleetSpeed({espionageProbe: 1}, researches))));
    }

    if (targetsToLaunch.length) {
      // pick shortest raid mission two-way flight
      raidTime = Math.min(...targetsToLaunch.map(target => target.meta.flightTime! * 2));
    }

    if (targetsToSpy.length) {
      this.state.status = 'sending probes';
      await processAll(targetsToSpy, async target => {
        await this.launcher.launch({
          from: target.meta.nearestPlanetId,
          to: target.coordinates,
          fleet: {espionageProbe: 1},
          mission: MissionType.Espionage
        });
        ++this.state.activeSlots;
      }, true);
    }

    if (targetsToLaunch.length) {
      console.log(`proposing targets to raid`, targetsToLaunch);
      /*
      this.state.status = 'sending raids';
      await processAll(targetsToLaunch, async target => {
        await this.launcher.launch({
          from: target.meta.nearestPlanetId,
          to: target.coordinates,
          fleet: {smallCargo: target.meta.requiredTransports},
          mission: MissionType.Attack
        });
        ++this.state.activeSlots;
      }, true);
       */
    }

    let currentDelay = raidEvents.length ? (raidEvents[0].time.getTime() - Date.now()) : Infinity;
    let delay = 1000 * (Math.min(spyTime, raidTime, currentDelay / 1000, 3600) + 5);
    this.state.nextResume = new Date(Date.now() + delay);
    this.state.status = 'idle';
    setTimeout(() => this.continue(), delay);
  }

  private pickTargets(nMissions: number, targetsToSpy: ProcessedReport[], targetsToLaunch: ProcessedReport[]) {
    this.state.status = 'picking targets';
    for (let i = 0; i < this.data.length && nMissions > 0; ++i) {
      let report = this.data[i], meta = report.meta, to = report.coordinates;
      if (meta.excluded) continue;
      if (report.infoLevel >= 4 && meta.requiredTransports! < this.state.minRaid) continue;
      if (report.infoLevel < 0 /*dummy*/ || meta.age! / meta.flightTime! > 0.5 || meta.age! > 3600) {
        targetsToSpy.push(report);
        --nMissions;
        continue;
      }
      if (report.playerStatus.toLowerCase().indexOf('i') < 0) // working only with inactive players
        continue;
      if (report.infoLevel < 2) {
        console.log(`insufficient report detail [${to.galaxy}:${to.system}:${to.position}]`);
        continue;
      }
      let hasFleet = this.sumValues(report.fleet) > 0,
          hasDefense = this.sumValues(report.defense, 'antiBallistic', 'interplanetary') > 0;
      if (hasFleet || hasDefense) {
        // maybe win by numbers?
        let ships = meta.requiredTransports!;
        let weakFleet = !hasFleet
            || this.sumValues(report.fleet, 'espionageProbe', 'solarSatellite') === 0 &&
            (report.fleet!.espionageProbe || 0) + (report.fleet!.solarSatellite || 0) <= ships;
        let weakDefense = !hasDefense ||
            this.sumValues(report.defense, 'rocketLauncher', 'antiBallistic', 'interplanetary') === 0
            && (report.defense!.rocketLauncher || 0) * 15 <= ships;
        if (!weakFleet || !weakDefense) {
          console.log(`target not clean [${to.galaxy}:${to.system}:${to.position}]`);
          continue;
        } else
          console.log(`unsafe raiding to [${to.galaxy}:${to.system}:${to.position}]`);
      }
      targetsToLaunch.push(report);
      --nMissions;
    }
  }

  private excludeActiveTargets(raidEvents: FlightEvent[]) {
    let excluded = raidEvents.map(event => event.to);
    this.data.forEach(report => {
      if (report && excluded.some(target => sameCoordinates(target, report.coordinates)))
        report.meta.excluded = true;
    })
  }

  private findRaidEvents(events: FlightEvent[]): FlightEvent[] {
    return events.filter(event => {
      if (!event.isReturn ||
          !event.isFriendly ||
          event.fleet.length !== 1 ||
          !(event.mission === MissionType.Attack || event.mission === MissionType.Espionage)
      ) return false;
      let fleet = event.fleet[0].fleet;
      if (Object.keys(fleet).length !== 1) return false;
      if (fleet.smallCargo && event.mission === MissionType.Attack) return true;
      if (!fleet.smallCargo && !fleet.espionageProbe ||
          fleet.smallCargo && event.mission !== MissionType.Attack ||
          fleet.espionageProbe && event.mission !== MissionType.Espionage
      ) return false;

      const to = event.to;
      return this.data.some(report => sameCoordinates(report.coordinates, to));
    });
  }

  private sumValues(obj: any, ...skipFields: string[]): number {
    return Object.keys(obj).reduce((sum: number, key) => {
      if (!skipFields || !skipFields.length || skipFields.every(field => field !== key)) sum += obj[key];
      return sum;
    }, 0)
  }
}
