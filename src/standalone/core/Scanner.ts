import {Coordinates, MissionType} from '../../common/types';
import {FlightCalculator} from '../../common/FlightCalculator';
import {nearestPlanet, PLANETS} from './GameContext';
import {Mapper} from './Mapper';

export class Scanner {
  static readonly instance: Scanner = new Scanner();

  targets: Coordinates[] = [];
  maxSlots: number = 11;
  usedSlots: number = 0;

  launchNext() {
    if (this.targets.length && this.usedSlots < this.maxSlots) {
      let target = this.targets.pop()!;
      let nearestPlanetId = nearestPlanet(target);
      let flightTime = FlightCalculator.flightTime(
          FlightCalculator.distanceC(target, PLANETS[nearestPlanetId]),
          FlightCalculator.fleetSpeed({espionageProbe: 1})
      );
      ++this.usedSlots;
      Mapper.instance.launch({
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
