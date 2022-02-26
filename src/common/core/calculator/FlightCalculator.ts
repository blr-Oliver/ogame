import {Coordinates, Fleet, FleetPartial, MissionType, Researches, ResearchType, ShipType, Speed} from '../../types';
import {UniverseContext} from '../UniverseContext';

export type ResourcePriority = 0 | 1 | 2;
export type ResourceOrder = [ResourcePriority, ResourcePriority, ResourcePriority];

export interface FlightCalculator {
  speedMultiplier(mission: MissionType): number;
  distance(g1: number, s1: number, p1: number, g2: number, s2: number, p2: number): number;
  distanceC(c1: Coordinates, c2: Coordinates): number;
  flightTime(distance: number, maxSpeed: number, percentage?: Speed, mission?: MissionType): number;
  fuelConsumption(distance: number, fleet: Fleet | FleetPartial, researches: Researches, flightTime: number, holdingTime?: number, mission?: MissionType): number;
  plunderWith(m: number, c: number, d: number, capacity: number, plunderFactor?: number, order?: ResourceOrder): [number, number, number];
  capacityFor(m: number, c: number, d: number, order?: ResourceOrder): number;
  fleetSpeed(fleet: FleetPartial | Fleet, researches: Researches): number;
}

export class StaticFlightCalculator implements FlightCalculator {
  constructor(readonly universe: UniverseContext) {
  }

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
    solarSatellite: 0,
    reaper: 7000,
    pathfinder: 12000,
    crawler: 0
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
    solarSatellite: 0,
    reaper: 3,
    pathfinder: 3,
    crawler: 0
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
    solarSatellite: 0,
    reaper: 1100,
    pathfinder: 300,
    crawler: 0
  };

  speedMultiplier(mission: MissionType): number {
    switch (mission) {
      case MissionType.Attack:
      case MissionType.Alliance:
      case MissionType.Espionage:
      case MissionType.Recycle:
      case MissionType.Destroy:
      case MissionType.MissileAttack:
        return this.universe.warFleetSpeed;
      case MissionType.Transport:
      case MissionType.Deploy:
      case MissionType.Colony:
      case MissionType.Expedition:
        return this.universe.peacefulFleetSpeed;
      case MissionType.Hold:
        return this.universe.holdingFleetSpeed;
      default:
        return 0;
    }
  }

  distance(g1: number, s1: number, p1: number, g2: number, s2: number, p2: number): number {
    if (g1 !== g2) {
      let diff = Math.abs(g1 - g2);
      if (this.universe.donutGalaxy)
        diff = Math.min(diff, this.universe.maxGalaxy - diff);
      return diff * 20000;
    }
    if (s1 !== s2) {
      let diff = Math.abs(s1 - s2);
      if (this.universe.donutSystem)
        diff = Math.min(diff, this.universe.maxSystem - diff);
      return diff * 95 + 2700;
    }
    if (p1 !== p2) {
      let diff = Math.abs(p1 - p2);
      return 1000 + 5 * diff;
    }
    return 5;
  }

  distanceC(c1: Coordinates, c2: Coordinates): number {
    return this.distance(c1.galaxy, c1.system, c1.position, c2.galaxy, c2.system, c2.position);
  }

  flightTime(distance: number, maxSpeed: number, percentage: Speed = 10, mission: MissionType = MissionType.Attack): number /* seconds */ {
    return Math.max(Math.round((10 + 35000 / percentage * Math.sqrt(10 * distance / maxSpeed)) / this.speedMultiplier(mission)), 1);
  }

  fuelConsumption(distance: number, fleet: Fleet | FleetPartial, researches: Researches, flightTime: number,
                  holdingTime: number = 0, mission: MissionType = MissionType.Attack): number {
    const speedMultiplier = this.speedMultiplier(mission);
    const fleetSpeedValue = Math.max(0.5, flightTime * speedMultiplier - 10);

    let consumption = 0, holdingCosts = 0;

    for (let key in fleet) {
      const shipType = key as ShipType;
      let n = fleet[shipType] || 0;
      if (n > 0) {
        const shipSpeed = this.fleetSpeed({[key]: 1}, researches);
        const shipConsumption = StaticFlightCalculator.BASE_CONSUMPTION[shipType];
        const shipSpeedPercentage = 35000 / fleetSpeedValue * Math.sqrt(distance * 10 / shipSpeed);

        holdingCosts += shipConsumption * n * holdingTime;
        consumption += Math.max(shipConsumption * n * distance / 35000 * (shipSpeedPercentage / 10 + 1) * (shipSpeedPercentage / 10 + 1), 1);
      }
    }

    consumption = Math.round(consumption);
    consumption += holdingTime > 0 ? Math.max(Math.floor(holdingCosts / 10), 1) : 0;
    return consumption;
  }

  plunderWith(m: number, c: number, d: number, capacity: number, plunderFactor = 0.5, order: ResourceOrder = [0, 1, 2]): [number, number, number] {
    let available = [m, c, d].map(r => r > 0 ? Math.floor(r * plunderFactor) : 0);
    let result: [number, number, number] = [0, 0, 0];

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

  capacityFor(m: number, c: number, d: number, order = [0, 1, 2]): number {
    let res: number[] = [Math.floor(m || 0), Math.floor(c || 0), Math.floor(d || 0)];
    [m, c, d] = [...res].map((x, i) => res[order[i]]);

    if (m <= c || (m << 1) <= c + d) return m + c + d;
    m <<= 1;
    if (3 * c >= m + d) return m + d;
    let t = 3 * (m + c + d);
    return (t >> 2) + +!!(t & 3); // = Math.ceil(t / 4)
  }

  fleetSpeed(fleet: FleetPartial | Fleet, researches: Researches): number {
    let speed = Infinity;
    for (let key in fleet) {
      let n = fleet[key as ShipType] || 0;
      if (n > 0) {
        let baseSpeed: number = StaticFlightCalculator.BASE_SPEED[key as ShipType];
        let drive = StaticFlightCalculator.SHIP_DRIVES[key as ShipType];
        let driveLevel = researches[StaticFlightCalculator.DRIVE_TYPES[drive]!] || 0;
        speed = Math.min(baseSpeed * (1 + driveLevel * drive / 10));
      }
    }
    return isFinite(speed) ? speed : 0;
  }
}
