import {FlightCalculator} from './core/FlightCalculator';
import {Coordinates, SpaceBody, SystemCoordinates} from './types';

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

export function processAll<T, R>(input: T[], action: (item: T) => Promise<R | undefined>, parallel: boolean = false): Promise<R[]> {
  if (parallel)
    return Promise.all(input.map(item => action(item)))
        .then(result => result.filter(x => !!x) as R[]);
  else
    return input.reduce((chain: Promise<R[]>, item: T) =>
            chain
                .then(list => action(item)
                    .then(result => (result && list.push(result), list))),
        Promise.resolve([]) as Promise<R[]>);
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

export function getNearest(bodies: SpaceBody[], coordinates: Coordinates) {
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
