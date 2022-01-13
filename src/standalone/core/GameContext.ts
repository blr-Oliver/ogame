import {Coordinates, Researches} from '../../common/types';
import {FlightCalculator} from '../../common/FlightCalculator';

export const CURRENT_RESEARCHES: Researches = {
  energy: 12,
  laser: 12,
  ion: 5,
  hyperspace: 8,
  plasma: 9,
  espionage: 12,
  computer: 13,
  astrophysics: 12,
  intergalactic: 4,
  graviton: 0,
  combustionDrive: 12,
  impulseDrive: 10,
  hyperspaceDrive: 8,
  weaponsUpgrade: 12,
  shieldingUpgrade: 12,
  armorUpgrade: 12
};

export const PLANETS: { [key: number]: Coordinates } = {
  '33639080': {
    galaxy: 1,
    system: 310,
    position: 8,
    type: 3
  },
  /*
  '33638393': {
    galaxy: 1,
    system: 310,
    position: 8
  },
  */
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
  let nearestDistance = Infinity, nearestPlanetId: number | null = null;
  for (let planetId in PLANETS) {
    let distance = FlightCalculator.distanceC(coordinates, PLANETS[planetId]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPlanetId = +planetId;
    }
  }
  if (!nearestPlanetId) throw new Error('couldn\'t find nearest planet (are any defined?)');
  return nearestPlanetId;
}
