import {getNearest} from '../common';
import {FlightCalculator} from '../core/FlightCalculator';
import {PlayerContext} from '../core/PlayerContext';
import {Coordinates, MissionType, Researches, SpaceBody} from '../types';
import {Launcher} from './Mapper';

export class Scanner {
  targets: Coordinates[] = [];
  maxSlots: number = 11;
  usedSlots: number = 0;

  constructor(private context: PlayerContext,
              private launcher: Launcher) {
  }

  continueScanning() {
    Promise.all([this.context.getResearches(), this.context.getBodies()])
        .then(([researches, bodies]) => this.launchNext(researches, bodies));
  }

  private launchNext(researches: Researches, bodies: SpaceBody[]) {
    if (this.targets.length && this.usedSlots < this.maxSlots) {
      let target = this.targets.pop()!;
      let nearestBody = getNearest(bodies, target);
      let nearestPlanetId = nearestBody.id;
      let flightTime = FlightCalculator.flightTime(
          FlightCalculator.distanceC(target, nearestBody.coordinates),
          FlightCalculator.fleetSpeed({espionageProbe: 1}, researches)
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
