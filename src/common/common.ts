import {FlightCalculator} from './core/calculator/FlightCalculator';
import {GalaxySlot} from './report-types';
import {Coordinates, CoordinateType, Fleet, FleetPartial, ShipType, ShipTypeId, SpaceBody, SystemCoordinates} from './types';

export const map: <T, U, A extends ArrayLike<T> | T[]>(array: A, callback: (value: T, index: number, array: A) => U, thisArg?: any) => U[] =
    Function.prototype.call.bind(Array.prototype.map);

export function deduplicate<T>(list: T[], compareFn?: (a: T, b: T) => number): T[] {
  if (!compareFn) compareFn = (a, b) => a < b ? -1 : (a > b ? 1 : 0);
  return list.sort(compareFn).reduce((res, next) => {
    if (!res.length || compareFn!(res[res.length - 1], next) < 0)
      res.push(next);
    return res;
  }, [] as T[]);
}

export async function processAll<T, R>(input: T[], action: (item: T) => Promise<R | undefined>, parallel?: boolean, filterEmpty?: true): Promise<R[]>
export async function processAll<T, R>(input: T[], action: (item: T) => Promise<R | undefined>, parallel: boolean, filterEmpty: boolean): Promise<(R | undefined)[]>
export async function processAll<T, R>(input: T[], action: (item: T) => Promise<R | undefined>, parallel: boolean = false, filterEmpty: boolean = true): Promise<(R | undefined)[]> {
  if (parallel) {
    let results = await Promise.all(input.map(item => action(item)));
    return filterEmpty ? results.filter(x => !!x) : results;
  } else {
    let results: (R | undefined)[] = [];
    for (let item of input) {
      let actionResult = await action(item);
      if (!filterEmpty || !!actionResult) results.push(actionResult);
    }
    return results;
  }
}

export function waitUntil<T>(primary: Promise<T>, ...others: Promise<any>[]): Promise<T> {
  return primary.then((result: T) => Promise.all(others).then(() => result));
}

export function after<T>(primary: Promise<T>, secondary: (r: T) => Promise<any>, parallel: boolean = false): Promise<T> {
  if (!parallel)
    return primary.then(r => secondary(r).then(() => r));
  primary.then(r => secondary(r));
  return primary;
}

export function systemCoordinatesKey(c: SystemCoordinates): string {
  return `${c[0]}:${c[1].toFixed().padStart(3, '0')}`;
}
export function compareCoordinatesKeys(a: SystemCoordinates, b: SystemCoordinates): number {
  return a[0] - b[0] || a[1] - b[1];
}

export function getNearest(bodies: SpaceBody[], coordinates: Coordinates, calculator: FlightCalculator) {
  let nearestDistance = Infinity, nearestBody: SpaceBody = bodies[0];
  for (let body of bodies) {
    let distance = calculator.distanceC(coordinates, body.coordinates);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestBody = body;
    }
  }
  return nearestBody;
}

export function sleep(delay: number): Promise<number> {
  if (delay <= 0) return Promise.resolve(0);
  const now = Date.now();
  return new Promise(resolve => {
    setTimeout(() => resolve(Date.now() - now), delay);
  });
}

export function sleepUntil(time: Date | number): Promise<number> {
  if (time instanceof Date) time = time.getTime();
  return sleep(time - Date.now());
}

export type PropertyMask = { [key: string]: true | PropertyMask };

export function objectsEqual<T>(a: T, b: T, mask: PropertyMask): boolean {
  for (let key in mask) {
    const value = mask[key];
    // @ts-ignore
    let aVal = a[key], bVal = b[key];
    if (value === true) {
      if (aVal !== bVal) return false;
    } else {
      if (aVal == null) {
        if (aVal !== bVal) return false;
      } else if (bVal == null) {
        if (aVal !== bVal) return false;
      } else {
        if (!objectsEqual(aVal, bVal, value)) return false;
      }
    }
  }
  return true;
}

const PMSK_PLANET_INFO: PropertyMask = {
  id: true,
  name: true
//  active: true,
//  activityTime: true
}
const PMSK_DEBRIS_INFO: PropertyMask = {
  metal: true,
  crystal: true
}
const PMSK_STATUS_INFO: PropertyMask = {
  inactive: true,
  vacation: true,
  banned: true,
  outlaw: true
}
const PMSK_PLAYER_INFO: PropertyMask = {
  id: true,
  name: true,
  status: PMSK_STATUS_INFO
}
const PMSK_ALLIANCE_INFO: PropertyMask = {
  id: true,
  name: true,
  shortName: true
}
const PMSK_GALAXY_SLOT: PropertyMask = {
  class: true,
  planet: PMSK_PLANET_INFO,
  moon: PMSK_PLANET_INFO,
  debris: PMSK_DEBRIS_INFO,
  player: PMSK_PLAYER_INFO,
  alliance: PMSK_ALLIANCE_INFO
};

export function slotsEqual(a: GalaxySlot, b: GalaxySlot): boolean {
  return objectsEqual(a, b, PMSK_GALAXY_SLOT);
}
export function coordinateComparator(a: Coordinates, b: Coordinates): number {
  return a.galaxy - b.galaxy || a.system - b.system || a.position - b.position || (a.type ?? CoordinateType.Planet) - (b.type ?? CoordinateType.Planet)
}
export function sameCoordinates(a?: Coordinates, b?: Coordinates): boolean {
  if (a && b) return coordinateComparator(a, b) === 0;
  return !a === !b;
}
export function sameFleet(a: Fleet | FleetPartial, b: Fleet | FleetPartial): boolean {
  for (let shipType in ShipTypeId) {
    if (typeof shipType === 'string') {
      const shipName = shipType as ShipType;
      if ((a[shipName] || 0) !== (b[shipName] || 0)) return false;
    }
  }
  return true;
}
export function toSortableString(c: Coordinates): string {
  return `[${c.galaxy.toFixed(0).padStart(2, '0')}:${c.system.toFixed(0).padStart(3, '0')}:${c.position.toFixed(0).padStart(2, '0')}:${c.type ?? CoordinateType.Planet}]`;
}