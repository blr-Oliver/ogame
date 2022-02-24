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
  maxTotalSlots: number = 21;
  timeShift = 1000 * 3600 * 3;
  maxReportAge = 1000 * 3600 * 0.5;
  rate: [number, number, number] = [1, 3, 4];

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
    console.debug(`Raider: loading events`);
    const events = await this.eventLoader.loadEvents();
    console.debug(`Raider: counting slots`);
    const [own, raid] = this.countSlots(events);
    const slotsLeft = Math.min(this.maxTotalSlots - this.minFreeSlots - own, this.maxRaidSlots - raid);
    console.debug(`Raider: occupied=${own} (raids=${raid}), available=${slotsLeft}`);
    if (slotsLeft <= 0) {
      this.scheduleContinue(events);
      return;
    }
    console.debug(`Raider: locating targets`);
    let [targets] = await Promise.all([
      this.galaxyRepo.findInactiveTargets(),
      this.espionageScrapper.loadAllReports()
    ]);
    const count = targets.length;
    const ongoingTargets = events.filter(event => this.isRaidEvent(event, false)).map(event => event.to);
    targets = targets.filter(target => !ongoingTargets.some(excluded => sameCoordinates(excluded, target)));
    console.debug(`Raider: excluded ${count - targets.length} ongoing targets`);
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
    await sleep(1000);
    this.scheduleContinue(await this.eventLoader.loadEvents());
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

  private scheduleContinue(events: FlightEvent[]) {
    const nextFinishing = events.find(event => this.isFinishingEvent(event));
    if (nextFinishing) {
      let shouldFinishAt = nextFinishing.time.getTime() + 5000;
      this.nextWakeUp = new Date(shouldFinishAt);
      console.debug(`Raider: sleeping until ${this.nextWakeUp}`);
      this.nextWakeUpId = setTimeout(() => this.continue(), shouldFinishAt - Date.now());
    } else {
      console.debug(`Raider: going idle`);
    }
  }

  private async launchMissions(missions: Mission[]): Promise<any> {
    return processAll(missions, async mission => {
      console.debug(`launching raid mission`, mission);
      return this.launcher.launch(mission);
    }, false);
  }
}
