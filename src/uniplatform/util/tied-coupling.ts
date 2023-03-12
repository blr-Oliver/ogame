import {FlightCalculator} from 'ogame-calc/FlightCalculator';
import {Coordinates, SpaceBody} from 'ogame-core/types/core';
import {GalaxySlot} from '../core/types/reports';

// TODO add it to calculator maybe
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