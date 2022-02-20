import {getNearest} from '../common';
import {FlightCalculator, StaticFlightCalculator} from '../core/calculator/FlightCalculator';
import {PlayerContext} from '../core/PlayerContext';
import {Coordinates, MissionType, Researches, SpaceBody} from '../types';
import {Launcher} from './Mapper';

export class Scanner {
  targets: Coordinates[] = [];
  maxSlots: number = 11;
  usedSlots: number = 0;

  constructor(private context: PlayerContext,
              private launcher: Launcher,
              private flightCalculator: FlightCalculator = StaticFlightCalculator.DEFAULT) {
  }

  continueScanning() {
    Promise.all([this.context.getResearches(), this.context.getBodies()])
        .then(([researches, bodies]) => this.launchNext(researches, bodies));
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
