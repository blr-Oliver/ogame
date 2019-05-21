import {Coordinates, MissionType, sameCoordinates, ShardedEspionageReport} from '../model/types';
import {FlightEvent} from '../parsers/event-list';
import {GalaxySystemInfo} from '../parsers/galaxy-reports';
import {EspionageRepository} from '../repository/EspionageRepository';
import {GalaxyRepository} from '../repository/GalaxyRepository';
import {ProcessedReport, ReportMetaInfo} from './Analyzer';
import {Calculator} from './Calculator';
import {FlightCalculator} from './FlightCalculator';
import {nearestPlanet, PLANETS} from './GameContext';
import {Mapper} from './Mapper';

export class AutoRaid {
  static readonly instance = new AutoRaid();
  state: any = {
    status: 'idle',
    nextResume: null,
    maxSlots: 0,
    rate: [1, 1, 1], // relative cost rate of resources
    harvestEspionage: false
  };

  private data: [Coordinates, ProcessedReport][] = null;

  continue() {
    if (this.state.maxSlots <= 0) return;
    (this.state.harvestEspionage ? this.checkSpyReports() : Promise.resolve(null)).then(() => {
      (this.data ? Promise.resolve(this.data) : this.reloadData())
          .then(pairs => {
            this.data = pairs as [Coordinates, ProcessedReport][];
            this.performNextLaunches();
          });
    })
  }

  private checkSpyReports(): Promise<void> {
    return Mapper.instance.loadAllReports().then((allReports) => {
      this.state.harvestEspionage = false;
      if (allReports.length)
        this.data = null;
    });
  }

  private reloadData(): Promise<[Coordinates, ShardedEspionageReport][]> {
    let mapper = Mapper.instance;
    let galaxyRepo = GalaxyRepository.instance;
    let espionageRepo = EspionageRepository.instance;
    this.state.status = 'checking galaxy info';
    return galaxyRepo
        .findStaleSystemsWithTargets(mapper.observe.normalTimeout)
        .then(systems => {
          if (!systems.length)
            return [] as GalaxySystemInfo[];
          this.state.status = 'refreshing galaxy info';
          return mapper.observeAllSystems(systems);
        })
        .then((/*freshGalaxies*/) => {
          this.state.status = 'fetching existing reports';
          return espionageRepo.findForInactiveTargets()
        });
  }

  private performNextLaunches() {
    this.state.status = 'rating reports';

    this.data.forEach(pair => {
      pair[1] = this.processReport(pair[0], pair[1]);
    });

    this.data.sort((a, b) =>
        +(b[1].infoLevel < 0) - +(a[1].infoLevel < 0) || /*dummies first*/
        b[1].meta.rating - a[1].meta.rating ||
        a[1].meta.distance - b[1].meta.distance
    );

    this.state.status = 'fetching events';
    Mapper.instance.loadEvents().then(events => {
      this.state.status = 'checking raids in progress';
      return this.findRaidEvents(events);
    }).then(raidEvents => {
      this.excludeActiveTargets(raidEvents); // TODO make possible to repeat on same target
      let missionsToGo = this.state.maxSlots - raidEvents.length;

      let targetsToSpy = [], targetsToLaunch = [];
      this.state.status = 'picking targets';
      for (let i = 0; i < this.data.length && missionsToGo > 0; ++i) {
        let report = this.data[i][1], meta = report.meta, to = report.coordinates;
        if (meta.excluded) continue;
        if (report.infoLevel < 0 /*dummy*/) {
          targetsToSpy.push(report);
          --missionsToGo;
          continue;
        }
        if (report.playerStatus.toLowerCase().indexOf('i') < 0) // working only with inactive players
          continue;
        if (report.infoLevel < 2) {
          console.log(`insufficient report detail [${to.galaxy}:${to.system}:${to.position}]`);
          continue;
        }
        if (this.sumValues(report.fleet) > 0 || this.sumValues(report.defense, 'antiBallistic', 'interplanetary') > 0) {
          console.log(`target not clean [${to.galaxy}:${to.system}:${to.position}]`);
          continue;
        }
        if (meta.old / meta.flightTime > 0.5 || meta.old > 3600)
          targetsToSpy.push(report);
        else
          targetsToLaunch.push(report);
        --missionsToGo;
      }

      let spyTime = Infinity, raidTime = Infinity;
      if (targetsToSpy.length) {
        this.state.harvestEspionage = true;
        spyTime = 0;
        // pick longest espionage mission one-way flight
        targetsToSpy.forEach(target => {
          let time = FlightCalculator.flightTime(target.meta.distance, FlightCalculator.fleetSpeed({espionageProbe: 1}));
          spyTime = Math.max(spyTime, time);
        });
      }
      if (targetsToLaunch.length) {
        // pick shortest raid mission two-way flight
        raidTime = Math.min(...targetsToLaunch.map(target => target.meta.flightTime * 2));
      }

      this.state.status = 'sending probes';
      let spies = targetsToSpy.reduce((chain, target) => chain.then(() => Mapper.instance.launch({
        from: target.meta.nearestPlanetId,
        to: target.coordinates,
        fleet: {espionageProbe: 1},
        mission: MissionType.Espionage
      })), Promise.resolve(null));

      let raids = targetsToLaunch.reduce((chain, target) => chain.then(() => Mapper.instance.launch({
        from: target.meta.nearestPlanetId,
        to: target.coordinates,
        fleet: {smallCargo: target.meta.requiredTransports},
        mission: MissionType.Attack
      })), spies.then(() => {
        this.state.status = 'sending raids';
      }));

      raids.then(() => {
        let currentDelay = raidEvents.length ? (raidEvents[0].arrivalTime.getTime() - Date.now()) : Infinity;
        let delay = 1000 * (Math.min(spyTime, raidTime, currentDelay / 1000, 3600) + 5);
        this.state.nextResume = new Date(Date.now() + delay);
        this.state.status = 'idle';
        setTimeout(() => this.continue(), delay);
      })
    });
  }

  private excludeActiveTargets(raidEvents: FlightEvent[]) {
    let excluded = raidEvents.map(event => event.to);
    this.data.forEach(pair => {
      if (pair[1] && excluded.some(target => sameCoordinates(target, pair[0])))
        pair[1].meta.excluded = true;
    })
  }

  private findRaidEvents(events: FlightEvent[]): FlightEvent[] {
    return events.filter(event => {
      if (!event.isReturnFlight ||
          !event.isFriendly ||
          event.fleet.length !== 1 ||
          !(event.mission === MissionType.Attack || event.mission === MissionType.Espionage)
      ) return false;
      let fleet = event.fleet[0].fleet;
      if (Object.keys(fleet).length !== 1) return false;
      if (fleet.smallCargo && event.mission !== MissionType.Attack ||
          fleet.espionageProbe && event.mission !== MissionType.Espionage
      ) return false;

      const to = event.to;
      return this.data.some(pair => sameCoordinates(pair[0], to));
    });
  }

  private processReport(to: Coordinates, report: ShardedEspionageReport | ProcessedReport): ProcessedReport {
    if (!report) {
      let dummy = {infoLevel: -1, coordinates: to, meta: {}} as ProcessedReport, meta = dummy.meta;
      meta.nearestPlanetId = nearestPlanet(to);
      meta.distance = FlightCalculator.distanceC(to, PLANETS[meta.nearestPlanetId]);
      return dummy;
    } else if (report.infoLevel === -1) {
      return report as ProcessedReport;
    }

    let meta: ReportMetaInfo = {}, now = Date.now(), result = report as ProcessedReport;
    result.meta = meta;

    //
    let nearestPlanetId = meta.nearestPlanetId = nearestPlanet(to);
    let nearestDistance = meta.distance = FlightCalculator.distanceC(to, PLANETS[nearestPlanetId]);
    let flightTime = meta.flightTime = FlightCalculator.flightTime(nearestDistance, FlightCalculator.fleetSpeed({smallCargo: 1}));
    //
    if (report.buildings) {
      let storageLevels: number[] = [report.buildings.metalStorage, report.buildings.crystalStorage, report.buildings.deutStorage];
      meta.capacity = storageLevels.map(l => Calculator.DEFAULT.getStorageCapacity(l));

      let mineLevels: number[] = [report.buildings.metalMine, report.buildings.crystalMine, report.buildings.deutMine];
      let unconstrainedProduction = mineLevels.map((l, i) => Calculator.DEFAULT.getProduction(i, l));
      let energyConsumption = mineLevels.map((l, i) => Calculator.DEFAULT.getEnergyConsumption(i, l));
      let requiredEnergy = energyConsumption.reduce((a, b) => a + b);
      let efficiency = Math.min(1, report.resources.energy / requiredEnergy);

      let mineProduction = unconstrainedProduction.map(x => x * efficiency);
      if (report.researches) {
        let plasmaLevel = report.researches.plasma;
        let bonus = [0.01, 0.0066, 0.0033].map(x => x * plasmaLevel);
        mineProduction = mineProduction.map((x, i) => x + x * bonus[i]);
      }

      meta.production = mineProduction.map((x, i) => x + Calculator.DEFAULT.naturalProduction[i]);
    } else {
      meta.capacity = Array(3).fill(Infinity);
      meta.production = Calculator.DEFAULT.naturalProduction.slice();
    }
    //
    let time = (now - report.source[0].timestamp.getTime() + flightTime * 1000) / 1000 / 3600;
    let original = [report.resources.metal, report.resources.crystal, report.resources.deut];
    let andProduced = meta.production.map((x, i) => x * time + original[i]);
    let expected = meta.expectedResources = andProduced.map((x, i) => Math.max(Math.min(x, meta.capacity[i]), original[i]));
    let requiredCapacity = FlightCalculator.capacityFor(expected[0] / 2, expected[1] / 2, expected[2] / 2);
    let nTransports = meta.requiredTransports = Math.ceil(requiredCapacity / 7000); // TODO compute based on current techs
    meta.fuelCost = FlightCalculator.fuelConsumption(meta.distance, {smallCargo: nTransports}, flightTime);
    let actualCapacity = nTransports * 7000;
    meta.expectedPlunder = FlightCalculator.plunderWith(expected[0], expected[1], expected[2], actualCapacity);
    meta.loadRatio = meta.expectedPlunder.reduce((a, b) => a + b, 0) / actualCapacity;
    meta.old = (now - report.source[0].timestamp.getTime()) / 1000;
    //
    meta.value = meta.expectedPlunder.reduce((value, x, i) => value + x * this.state.rate[i], 0);
    meta.rating = meta.value / flightTime;

    return result;
  }

  private sumValues(obj: any, ...skipFields: string[]): number {
    return Object.keys(obj).reduce((sum: number, key) => {
      if (!skipFields || !skipFields.length || skipFields.every(field => field !== key)) sum += obj[key];
      return sum;
    }, 0)
  }
}
