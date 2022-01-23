import {Coordinates, Fleet, FleetPartial, Researches, ResearchType, ShipType, Speed} from './types';

export class FlightCalculator {
  static readonly FLIGHT_MULTIPLIER = 2;
  static readonly BASE_SPEED: { readonly [key in ShipType]: number } = {
    lightFighter: 12500,
    heavyFighter: 10000,
    cruiser: 15000,
    battleship: 10000,
    battlecruiser: 10000,
    bomber: 5000,
    destroyer: 5000,
    deathStar: 100,
    smallCargo: 10000,
    largeCargo: 7500,
    colonyShip: 2500,
    recycler: 2000,
    espionageProbe: 100000000,
    solarSatellite: 0
  };
  static readonly DRIVE_TYPES: (ResearchType | undefined)[] = [undefined, 'combustionDrive', 'impulseDrive', 'hyperspaceDrive'];
  static readonly SHIP_DRIVES: { readonly [key in ShipType]: number } = {
    lightFighter: 1,
    heavyFighter: 2,
    cruiser: 2,
    battleship: 3,
    battlecruiser: 3,
    bomber: 3,
    destroyer: 3,
    deathStar: 3,
    smallCargo: 2,
    largeCargo: 1,
    colonyShip: 2,
    recycler: 1,
    espionageProbe: 1,
    solarSatellite: 0
  };
  static readonly BASE_CONSUMPTION: { readonly [key in ShipType]: number } = {
    lightFighter: 20,
    heavyFighter: 75,
    cruiser: 300,
    battleship: 500,
    battlecruiser: 250,
    bomber: 1000,
    destroyer: 1000,
    deathStar: 1,
    smallCargo: 20,
    largeCargo: 50,
    colonyShip: 1000,
    recycler: 300,
    espionageProbe: 1,
    solarSatellite: 0
  };

  private static readonly GALAXY_COUNT = 7;
  private static readonly SYSTEM_COUNT = 499;
  static distance(g1: number, s1: number, p1: number, g2: number, s2: number, p2: number): number {
    if (g1 !== g2) {
      let diff = Math.abs(g1 - g2);
      return Math.min(diff, this.GALAXY_COUNT - diff) * 20000;
    }
    if (s1 !== s2) {
      let diff = Math.abs(s1 - s2);
      return Math.min(diff, this.SYSTEM_COUNT - diff) * 95 + 2700;
    }
    if (p1 !== p2) {
      let diff = Math.abs(p1 - p2);
      return 1000 + 5 * diff;
    }
    return 5;
  }

  static distanceC(c1: Coordinates, c2: Coordinates): number {
    return this.distance(c1.galaxy, c1.system, c1.position, c2.galaxy, c2.system, c2.position);
  }

  static flightTime(distance: number, maxSpeed: number, percentage: Speed = 10): number /* seconds */ {
    return Math.ceil((10 + 35000 / percentage * Math.sqrt(10 * distance / maxSpeed)) / this.FLIGHT_MULTIPLIER);
  }

  static fuelConsumption(distance: number, fleet: Fleet | FleetPartial, researches: Researches, flightTime?: number, percentage: Speed = 10) {
    flightTime = flightTime || this.flightTime(distance, this.fleetSpeed(fleet, researches), percentage);

    let total = 0, shipSpeed: number, shipPercentage: number;

    for (let key in fleet) {
      let n = fleet[key as ShipType] || 0;
      if (n > 0) {
        shipSpeed = this.fleetSpeed({[key]: 1}, researches);
        shipPercentage = 35000 / (flightTime * this.FLIGHT_MULTIPLIER - 10) * Math.sqrt(10 * distance / shipSpeed);
        total += this.BASE_CONSUMPTION[key as ShipType] * n * (shipPercentage / 10 + 1) * (shipPercentage / 10 + 1);
      }
    }

    return 1 + Math.round(total * distance / 35000 / this.FLIGHT_MULTIPLIER);
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
      let loading = Math.min(Math.ceil(capacity / capacityFactor), available[resourceIndex]);
      capacity -= loading;
      available[resourceIndex] -= loading;
      result[resourceIndex] += loading;
    }
  }

  static capacityFor(m: number, c: number, d: number, order = [0, 1, 2]): number {
    let res: number[] = [Math.floor(m || 0), Math.floor(c || 0), Math.floor(d || 0)];
    [m, c, d] = [...res].map((x, i) => res[order[i]]);

    if (m <= c || (m << 1) <= c + d) return m + c + d;
    m <<= 1;
    if (3 * c >= m + d) return m + d;
    let t = 3 * (m + c + d);
    return t >> 2 + +!!(t & 3); // = Math.ceil(t / 4)
  }

  static fleetSpeed(fleet: FleetPartial | Fleet, researches: Researches) {
    let speed = Infinity;
    for (let key in fleet) {
      let n = fleet[key as ShipType] || 0;
      if (n > 0) {
        let baseSpeed: number = this.BASE_SPEED[key as ShipType];
        let drive = this.SHIP_DRIVES[key as ShipType];
        let driveLevel = researches[this.DRIVE_TYPES[drive]!];
        speed = Math.min(baseSpeed * (1 + driveLevel * drive / 10));
      }
    }
    return isFinite(speed) ? speed : 0;
  }
}
