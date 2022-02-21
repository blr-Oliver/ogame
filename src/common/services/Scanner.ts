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
  maxSlots: number = 11;
  usedSlots: number = 0;

  constructor(private context: PlayerContext,
              private espionageRepo: EspionageRepository,
              private launcher: Launcher,
              private eventLoader: EventListLoader,
              private espionageScrapper: EspionageReportScrapper,
              private flightCalculator: FlightCalculator) {
  }

  continueScanning() {
    Promise.all([this.context.getResearches(), this.context.getBodies()])
        .then(([researches, bodies]) => this.launchNext(researches, bodies));
  }
  /*
    async scan(coordinates: Coordinates, infoLevel?: number): Promise<EspionageReport> {
      const ownResearches = await this.context.getResearches();
      const ownEspionage = ownResearches.espionage;
      let existingReport = await this.espionageRepo.loadC(coordinates);
      if (existingReport) {
        if (existingReport.infoLevel === 4) {
          let foreignEspionage = existingReport.researches!.espionage;
        }
      }
      return existingReport!;
    }
  */
  async probe(target: Coordinates, probes: number = 1): Promise<StampedEspionageReport> {
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
    await sleep(1000);
    let allReports = await this.espionageScrapper.loadAllReports(); // TODO
    return allReports[0];
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

  private launchNext(researches: Researches, bodies: SpaceBody[]) {
    if (this.targets.length && this.usedSlots < this.maxSlots) {
      let target = this.targets.pop()!;
      let nearestBody = getNearest(bodies, target, this.flightCalculator);
      let nearestPlanetId = nearestBody.id;
      let flightTime = this.flightCalculator.flightTime(
          this.flightCalculator.distanceC(target, nearestBody.coordinates),
          this.flightCalculator.fleetSpeed({espionageProbe: 1}, researches)
      );
      ++this.usedSlots;
      this.launcher.launch({
        from: nearestPlanetId,
        to: target,
        fleet: {espionageProbe: 1},
        mission: MissionType.Espionage
      }).then(() => {
        setTimeout(() => {
          --this.usedSlots;
          this.launchNext(researches, bodies);
        }, (flightTime * 2 + 5) * 1000);
        this.launchNext(researches, bodies);
      });
    }
  }
}
