import {Coordinates, Researches, SpaceBody} from '../types';
import {FlightCalculator} from './FlightCalculator';

export abstract class GameContext {
  abstract getResearches(): Researches;
  abstract getBodies(): SpaceBody[];
  readonly maxGalaxy: number;
  readonly maxSystem: number;

  constructor(maxGalaxy: number, maxSystem: number) {
    this.maxGalaxy = maxGalaxy;
    this.maxSystem = maxSystem;
  }

  getNearestBody(coordinates: Coordinates): SpaceBody {
    let bodies = this.getBodies();
    let nearestDistance = Infinity, nearestBody: SpaceBody = bodies[0];
    for (let body of bodies) {
      let distance = FlightCalculator.distanceC(coordinates, body.coordinates);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestBody = body;
      }
    }
    return nearestBody;
  }
}
