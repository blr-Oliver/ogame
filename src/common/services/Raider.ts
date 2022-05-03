import {processAll, sleep} from '../common';
import {PlayerContext} from '../core/PlayerContext';
import {FlightEvent} from '../report-types';
import {EspionageRepository, GalaxyRepository} from '../repository-types';
import {Coordinates, FleetPartial, Mission, MissionType, sameCoordinates} from '../types';
import {EspionageReportScrapper} from './EspionageReportScrapper';
import {EventListLoader, Launcher} from './Mapper';
import {RaidReportAnalyzer, SuggestionRequest} from './RaidReportAnalyzer';

export class Raider {
  maxRaidSlots: number = 0;
  minFreeSlots: number = 0;
  maxTotalSlots: number = 0;
  timeShift = 1000 * 3600 * 3;
  maxReportAge = 1000 * 3600 * 0.5;
  rate: [number, number, number] = [1, 3, 4];
  excludedOrigins: number[] = [];
  excludedTargets: Coordinates[] = [];

  private nextWakeUp?: Date;
  private nextWakeUpId?: number;

  constructor(
      private readonly player: PlayerContext,
      private readonly galaxyRepo: GalaxyRepository,
      private readonly espionageRepo: EspionageRepository,
      private readonly espionageScrapper: EspionageReportScrapper,
      private readonly eventLoader: EventListLoader,
      private readonly analyzer: RaidReportAnalyzer,
      private readonly launcher: Launcher
  ) {
  }

  async continue() {
    if (this.nextWakeUpId) {
      clearTimeout(this.nextWakeUpId);
      this.nextWakeUpId = undefined;
      this.nextWakeUp = undefined;
    }
    if (this.maxRaidSlots <= 0) {
      console.debug(`Raider: disabled, going idle`);
      return;
    }
    let events: FlightEvent[] | undefined;
    try {
      console.debug(`Raider: loading events`);
      events = await this.eventLoader.loadEvents();
      console.debug(`Raider: counting slots`);
      const [own, raid] = this.countSlots(events!);
      const slotsLeft = Math.min(this.maxTotalSlots - this.minFreeSlots - own, this.maxRaidSlots - raid);
      console.debug(`Raider: occupied=${own} (raids=${raid}), available=${slotsLeft}`);
      if (slotsLeft > 0) {
        console.debug(`Raider: locating targets`);
        let [targets] = await Promise.all([
          this.galaxyRepo.findInactiveTargets(),
          // loading reports in parallel with searching the repo
          this.espionageScrapper.loadAllReports()
        ]);
        targets = this.filterTargets(targets, events);
        events = undefined;
        await this.espionageRepo.deleteOldReports();
        let unexploredTargets: Coordinates[] = [];
        console.debug(`Raider: loading reports`);
        const reports = await processAll(targets, async target => {
          const report = await this.espionageRepo.loadC(target);
          if (!report) unexploredTargets.push(target);
          else return report;
        }, true, true);
        console.debug(`Raider: loading context`);
        let [researches, bodies] = await Promise.all([this.player.getResearches(), this.player.getBodies()]);
        let fleet: { [bodyId: number]: FleetPartial } = {};
        await processAll(bodies, async body => {
          fleet[body.id] = await this.player.getFleet(body.id);
        }, false, false);
        bodies = bodies.filter(body => (fleet[body.id].smallCargo || 0) > 0);
        bodies = bodies.filter(body => !this.excludedOrigins.some(id => body.id === id));
        const request: SuggestionRequest = {
          unexploredTargets,
          reports,
          bodies,
          researches,
          fleet,
          timeShift: this.timeShift,
          rating: this.rate,
          maxReportAge: this.maxReportAge,
          minRaid: 1,
          maxMissions: slotsLeft
        };
        console.debug(`Raider: analyzing`);
        const missions = this.analyzer.suggestMissions(request);
        console.debug(`Raider: launching`);
        await this.launchMissions(missions);
      }
    } finally {
      await sleep(1000);
      await this.scheduleContinue(events);
    }
  }

  private filterTargets(targets: Coordinates[], events: FlightEvent[]): Coordinates[] {
    let count = targets.length;
    const ongoingTargets = events!.filter(event => this.isRaidEvent(event, false)).map(event => event.to);
    targets = targets.filter(target => !ongoingTargets.some(excluded => sameCoordinates(excluded, target)));
    if (count !== targets.length) {
      console.debug(`Raider: excluded ${count - targets.length} ongoing targets`);
      count = targets.length;
    }
    targets = targets.filter(target => !this.excludedTargets.some(excluded => sameCoordinates(excluded, target)));
    if (count !== targets.length) {
      console.debug(`Raider: explicitly excluded ${count - targets.length} targets`);
    }
    return targets;
  }

  private countSlots(events: FlightEvent[]): [number, number] {
    return events.reduce(([own, raid], event) =>
            [own + +this.isOwnEvent(event), raid + +this.isRaidEvent(event)],
        [0, 0]);
  }

  private isRaidEvent(event: FlightEvent, isReturn = true): boolean {
    if (!event.isFriendly || event.isReturn !== isReturn) return false;
    if (event.mission === MissionType.Attack) {
      if (event.fleet.length !== 1) return false;
      const fleet = event.fleet[0].fleet;
      return ('smallCargo' in fleet) && Object.keys(fleet).length === 1;
    } else if (event.mission === MissionType.Espionage) {
      if (event.fleet.length !== 1) return false;
      const fleet = event.fleet[0].fleet;
      return ('espionageProbe' in fleet) && Object.keys(fleet).length === 1;
    } else
      return false;
  }

  private isOwnEvent(event: FlightEvent): boolean {
    return event.isFriendly && (event.isReturn || event.mission === MissionType.Deploy);
  }

  private isFinishingEvent(event: FlightEvent): boolean {
    return event.isFriendly && (event.isReturn || event.mission === MissionType.Deploy || event.mission === MissionType.Colony);
  }

  private async scheduleContinue(events?: FlightEvent[]) {
    if (!events) {
      try {
        events = await this.eventLoader.loadEvents();
      } catch (e) {
        console.debug(`Raider: failed forecasting next wake up`);
        this.doScheduleContinue(Date.now() + 1000 * 60 * 10); // sleeping for 10 minutes
        return;
      }
    }
    const nextFinishing = events.find(event => this.isFinishingEvent(event));
    if (nextFinishing) {
      this.doScheduleContinue(nextFinishing.time.getTime() + 5000);
    } else {
      console.debug(`Raider: going idle`);
    }
  }

  private doScheduleContinue(timestamp: number) {
    this.nextWakeUp = new Date(timestamp);
    console.debug(`Raider: sleeping until ${this.nextWakeUp}`);
    this.nextWakeUpId = setTimeout(() => this.continue(), timestamp - Date.now());
  }

  private async launchMissions(missions: Mission[]): Promise<any> {
    return processAll(missions, async mission => this.launcher.launch(mission), true);
  }
}
