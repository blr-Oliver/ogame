import {FlightCalculator} from '../../common/FlightCalculator';
import {Mapper} from '../../common/report-types';
import {Coordinates, MissionType} from '../../common/types';
import {CURRENT_RESEARCHES, nearestPlanet, PLANETS} from './GameContext';

export class Scanner {
  targets: Coordinates[] = [];
  maxSlots: number = 11;
  usedSlots: number = 0;

  constructor(private mapper: Mapper) {
  }

  launchNext() {
    if (this.targets.length && this.usedSlots < this.maxSlots) {
      let target = this.targets.pop()!;
      let nearestPlanetId = nearestPlanet(target);
      let flightTime = FlightCalculator.flightTime(
          FlightCalculator.distanceC(target, PLANETS[nearestPlanetId]),
          FlightCalculator.fleetSpeed({espionageProbe: 1}, CURRENT_RESEARCHES)
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
