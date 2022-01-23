import {FlightCalculator} from '../FlightCalculator';
import {Coordinates, Researches, SpaceBody} from '../types';

export abstract class GameContext {
  abstract getResearches(): Researches;
  abstract getBodies(): SpaceBody[];
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
  /**
   * @deprecated getBodies should be used instead
   */
  getCoordinates(): { [key: number]: Coordinates } {
    let bodies = this.getBodies();
    return bodies.reduce((result, body) => {
      result[body.id] = body.coordinates;
      return result;
    }, {} as { [key: number]: Coordinates })
  }
}
