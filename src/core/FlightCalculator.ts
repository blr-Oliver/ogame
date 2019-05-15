import {Coordinates, CoordinateType} from '../model/types';

export class FlightCalculator {
  static calculateDistance(g1: number, s1: number, p1: number, g2: number, s2: number, p2: number): number {
    if (g1 !== g2) {
      let diff = Math.abs(g1 - g2);
      return Math.min(diff, 7 - diff) * 20000;
    }
    if (s1 !== s2) {
      let diff = Math.abs(s1 - s2);
      return Math.min(diff, 499 - diff) * 95 + 2700;
    }
    if (p1 !== p2) {
      let diff = Math.abs(p1 - p2);
      return 1000 + 5 * diff;
    }
    return 5;
  }

  static calculateDistanceC(c1: Coordinates, c2: Coordinates): number {
    return this.calculateDistance(c1.galaxy, c1.system, c1.position, c2.galaxy, c2.system, c2.position);
  }

  static flightTime(distance: number, speed: number = 22000): number {
    return (10 + 3500 * Math.sqrt(10 * distance / speed)) / 2;
  }

  static fuelConsumption(distance: number, quantity: number, baseConsumption: number = 10) {
    return 1 + Math.round(quantity * baseConsumption * distance * 4 / 35000);
  }

  static plunderWith(m: number, c: number, d: number, capacity: number, plunderFactor = 0.5, order = [0, 1, 2]): number[] {
    let available = [m, c, d].map(r => r > 0 ? Math.floor(r * plunderFactor) : 0);
    let result = [0, 0, 0];

    for (let i = 0; i < 3; ++i)
      load(3 - i, order[i]);
    if (capacity > 0)
      for (let i = 0; i < 2; ++i)
        load(2 - i, order[i]);

    return result;

    function load(capacityFactor: number, resourceIndex: number) {
      var loading = Math.min(Math.ceil(capacity / capacityFactor), available[resourceIndex]);
      capacity -= loading;
      available[resourceIndex] -= loading;
      result[resourceIndex] += loading;
    }
  }

  static capacityFor(m: number, c: number, d: number, order = [0, 1, 2]): number {
    let res: number[] = [Math.floor(m || 0), Math.floor(c || 0), Math.floor(d || 0)];
    [m, c, d] = [...res].map((x, i) => res[order[i]]);

    if (c < m && c + d < (m << 1)) { // magic
      let temp = ((m << 1) + c + d) * 3; // STRONG magic
      return (temp >> 2) + +!!(temp & 3); // wtf is going on?
    }

    return m + c + d;
  }
}
