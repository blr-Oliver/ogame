import {processAll, sameCoordinates, sleep} from '../common';
import {PlayerContext} from '../core/PlayerContext';
import {FlightEvent} from '../report-types';
import {EspionageRepository, GalaxyRepository} from '../repository-types';
import {Coordinates, CoordinateType, FleetPartial, Mission, MissionType} from '../types';
import {EspionageReportScrapper} from './operations/EspionageReportScrapper';
import {EventListLoader, Launcher} from './Mapper';
import {ThreatNotifier} from './notification/ThreatNotifier';
import {RaidReportAnalyzer, SuggestionRequest} from './RaidReportAnalyzer';

export interface Settings {
  maxRaidSlots: number;
  minFreeSlots: number;
  maxTotalSlots: number;
  excludedOrigins: number[];
  excludedTargets: Coordinates[];
  maxSleepTimeMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
  maxRaidSlots: 0,
  minFreeSlots: 0,
  maxTotalSlots: 0,
  excludedOrigins: [],
  excludedTargets: [],
  maxSleepTimeMs: 1000 * 60 * 10
}

export class Raider {
  private nextWakeUp?: Date;
  private nextWakeUpId?: ReturnType<typeof setTimeout>;

  constructor(
      private readonly player: PlayerContext,
      private readonly galaxyRepo: GalaxyRepository,
      private readonly espionageRepo: EspionageRepository,
      private readonly espionageScrapper: EspionageReportScrapper,
      private readonly eventLoader: EventListLoader,
      private readonly analyzer: RaidReportAnalyzer,
      private readonly launcher: Launcher,
      private readonly threatNotifier: ThreatNotifier,
      public settings: Settings = DEFAULT_SETTINGS
  ) {
  }

  async continue() {
    if (this.nextWakeUpId) {
      clearTimeout(this.nextWakeUpId);
      this.nextWakeUpId = undefined;
      this.nextWakeUp = undefined;
    }
    if (this.settings.maxRaidSlots <= 0) {
      console.debug(`Raider: disabled, going idle`);
      return;
    }
    let events: FlightEvent[] | undefined;
    try {
      console.debug(`Raider: loading events`);
      events = await this.eventLoader.loadEvents();
      this.threatNotifier.detectAndNotifyThreats(events);
      console.debug(`Raider: counting slots`);
      const [own, raid] = this.countSlots(events!);
      const slotsLeft = Math.min(this.settings.maxTotalSlots - this.settings.minFreeSlots - own, this.settings.maxRaidSlots - raid);
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
        // await this.espionageRepo.deleteOldReports();
        let unexploredTargets: Coordinates[] = [];
        console.debug(`Raider: loading reports`);
        const reports = await processAll(targets, async target => {
          const report = await this.espionageRepo.loadC(target);
          if (!report) unexploredTargets.push(target);
          else return report;
        }, true, true);
        console.debug(`Raider: loading context`);
        let [researches, bodies] = await Promise.all([this.player.getResearches(), this.player.getBodies()]);
        bodies = bodies.filter(body => !body.companion || body.coordinates.type === CoordinateType.Moon);
        bodies = bodies.filter(body => !this.settings.excludedOrigins.some(id => body.id === id));
        let fleet: { [bodyId: number]: FleetPartial } = {};
        await processAll(bodies, async body => {
          fleet[body.id] = await this.player.getFleet(body.id);
        }, false, false);
        bodies = bodies.filter(body => (fleet[body.id].smallCargo || 0) > 0);
        const request: SuggestionRequest = {
          unexploredTargets,
          reports,
          bodies,
          researches,
          fleet,
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
    targets = targets.filter(target => !this.settings.excludedTargets.some(excluded => sameCoordinates(excluded, target)));
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
    let delay: number = this.settings.maxSleepTimeMs || 0;
    if (!events) {
      try {
        events = await this.eventLoader.loadEvents();
      } catch (e) {
        console.debug(`Raider: failed forecasting next wake up`);
      }
    }
    if (events) {
      const nextFinishing = events.find(event => this.isFinishingEvent(event));
      if (nextFinishing)
        delay = Math.min(nextFinishing.time.getTime() + 5000 - Date.now(), delay);
    }
    this.doScheduleContinue(Date.now() + delay);
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
