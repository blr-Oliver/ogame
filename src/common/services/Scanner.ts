import {FlightCalculator} from '../core/FlightCalculator';
import {AbstractGameContext} from '../core/GameContext';
import {Coordinates, MissionType} from '../types';
import {Mapper} from './Mapper';

export class Scanner {
  targets: Coordinates[] = [];
  maxSlots: number = 11;
  usedSlots: number = 0;

  constructor(private context: AbstractGameContext,
              private mapper: Mapper) {
  }

  launchNext() {
    if (this.targets.length && this.usedSlots < this.maxSlots) {
      let target = this.targets.pop()!;
      let nearestBody = this.context.getNearestBody(target);
      let nearestPlanetId = nearestBody.id;
      let flightTime = FlightCalculator.flightTime(
          FlightCalculator.distanceC(target, nearestBody.coordinates),
          FlightCalculator.fleetSpeed({espionageProbe: 1}, this.context.getResearches())
      );
      ++this.usedSlots;
      this.mapper.launch({
        from: nearestPlanetId,
        to: target,
        fleet: {espionageProbe: 1},
        mission: MissionType.Espionage
      }).then(() => {
        setTimeout(() => {
          --this.usedSlots;
          this.launchNext();
        }, (flightTime * 2 + 5) * 1000);
        this.launchNext();
      });
    }
  }
}
