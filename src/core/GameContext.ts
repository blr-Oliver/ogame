import {Coordinates, Researches} from '../model/types';
import {FlightCalculator} from './FlightCalculator';

export const CURRENT_RESEARCHES: Researches = {
  energy: 12,
  laser: 12,
  ion: 5,
  hyperspace: 8,
  plasma: 7,
  espionage: 11,
  computer: 12,
  astrophysics: 11,
  intergalactic: 4,
  graviton: 0,
  combustionDrive: 10,
  impulseDrive: 8,
  hyperspaceDrive: 8,
  weaponsUpgrade: 10,
  shieldingUpgrade: 11,
  armorUpgrade: 10
};

export const PLANETS: { [key: number]: Coordinates } = {
  '33638474': {
    galaxy: 1,
    system: 266,
    position: 11
  },
  '33638483': {
    galaxy: 2,
    system: 292,
    position: 13
  },
  '33638501': {
    galaxy: 1,
    system: 26,
    position: 14
  },
  '33638977': {
    galaxy: 5,
    system: 147,
    position: 15
  },
  '33638988': {
    galaxy: 1,
    system: 143,
    position: 15
  }
};

export function nearestPlanet(coordinates: Coordinates): number {
  let nearestDistance = Infinity, nearestPlanetId: number = null;
  for (let planetId in PLANETS) {
    let distance = FlightCalculator.distanceC(coordinates, PLANETS[planetId]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPlanetId = +planetId;
    }
  }
  return nearestPlanetId;
}
