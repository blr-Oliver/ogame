import {EspionageBrief} from '../../browser/parsers/no-dom/espionage-report-no-dom';
import {getNearest, sleep, sleepUntil} from '../common';
import {FlightCalculator} from '../core/calculator/FlightCalculator';
import {PlayerContext} from '../core/PlayerContext';
import {FlightEvent, StampedEspionageReport} from '../report-types';
import {EspionageRepository} from '../repository-types';
import {Coordinates, CoordinateType, Fleet, FleetPartial, Mission, MissionType, Researches, sameCoordinates, sameFleet, SpaceBody} from '../types';
import {EspionageReportScrapper} from './EspionageReportScrapper';
import {EventListLoader, Launcher} from './Mapper';

export class Scanner {
  targets: Coordinates[] = [];
  probes: number = 1;
  maxSlots: number = 0;
  usedSlots: number = 0;
  private working: boolean = false;

  constructor(private context: PlayerContext,
              private espionageRepo: EspionageRepository,
              private launcher: Launcher,
              private eventLoader: EventListLoader,
              private espionageScrapper: EspionageReportScrapper,
              private flightCalculator: FlightCalculator) {
  }

  continueScanning(probes: number = 1) {
    this.probes = probes;
    if (!this.working) {
      Promise.all([
        this.context.getResearches(),
        this.context.getBodies()
      ]).then(([researches, bodies]) => this.launchNext(researches, bodies));
    }
  }

  async probe(target: Coordinates, probes: number = 1): Promise<StampedEspionageReport | undefined> {
    const [ownBodies, ownResearches] = await Promise.all([
      this.context.getBodies(),
      this.context.getResearches()
    ]);
    let origin = getNearest(ownBodies, target, this.flightCalculator);
    if (origin.companion && origin.coordinates.type === CoordinateType.Planet)
      origin = origin.companion;
    const mission: Mission = {
      from: origin.id,
      to: target,
      speed: 10,
      fleet: {espionageProbe: probes},
      mission: MissionType.Espionage
    };
    await this.launcher.launch(mission);
    await sleep(1000);
    const events = await this.eventLoader.loadEvents();
    const matchingEvent = this.findEvent(events, origin.coordinates, target, mission.fleet)!;
    await sleepUntil(matchingEvent.time);
    await sleep(2000);
    const briefs = await this.espionageScrapper.loadReportList();
    const matchingBrief = this.findBrief(briefs.reports, target, matchingEvent.time);
    return this.espionageScrapper.loadReport(matchingBrief!.header.id);
  }

  private findEvent(list: FlightEvent[], from: Coordinates, to: Coordinates, fleet: Fleet | FleetPartial): FlightEvent | undefined {
    let matching = list.filter(flight => {
      if (!flight.isFriendly || flight.isReturn || flight.mission !== MissionType.Espionage) return false;
      if (!sameCoordinates(flight.to, to)) return false;
      if (flight.fleet.length !== 1) return false;
      const eventFleet = flight.fleet[0];
      if (!sameCoordinates(eventFleet.from, from)) return false;
      return sameFleet(eventFleet.fleet, fleet);
    });
    if (matching.length) return matching[matching.length - 1];
  }

  private findBrief(list: EspionageBrief[], coordinates: Coordinates, timestamp: Date, variance: number = 2000): EspionageBrief | undefined {
    const forTarget = list
        .filter(report => !report.isCounterEspionage)
        .filter(report => sameCoordinates(report.header.coordinates, coordinates));
    const withinVariance = forTarget
        .filter(report => Math.abs(report.header.timestamp.getTime() - timestamp.getTime()) <= variance);
    // return withinVariance[0];
    // TODO fix server/local time shift
    return forTarget[0];
  }

  private async launchNext(ownResearches: Researches, ownBodies: SpaceBody[]) {
    if (this.working) return;

    this.working = true;

    while (this.targets.length) {
      if (this.usedSlots >= this.maxSlots) {
        await sleep(5000);
        continue;
      }
      let target = this.targets.shift()!;
      let origin = getNearest(ownBodies, target, this.flightCalculator);
      if (origin.companion && origin.coordinates.type === CoordinateType.Planet)
        origin = origin.companion;
      const mission: Mission = {
        from: origin.id,
        to: target,
        speed: 10,
        fleet: {espionageProbe: this.probes},
        mission: MissionType.Espionage
      };
      let flightTime = this.flightCalculator.flightTime(
          this.flightCalculator.distanceC(target, origin.coordinates),
          this.flightCalculator.fleetSpeed(mission.fleet, ownResearches)
      );
      ++this.usedSlots;
      try {
        await this.launcher.launch(mission);
        setTimeout(() => {
          --this.usedSlots;
        }, (flightTime * 2 + 3) * 1000);
      } catch (e) {
        --this.usedSlots;
        this.targets.push(target);
      }
    }
    this.working = false;
  }
}
