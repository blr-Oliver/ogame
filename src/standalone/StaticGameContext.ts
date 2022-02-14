import {AbstractGameContext} from '../common/core/GameContext';
import {Researches, SpaceBody} from '../common/types';

const CURRENT_RESEARCHES: Researches = {
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

const PLANETS: SpaceBody[] = [
  {
    id: 33639080,
    coordinates: {
      galaxy: 1,
      system: 310,
      position: 8,
      type: 3
    }
  }, {
    id: 33638393,
    coordinates: {
      galaxy: 1,
      system: 310,
      position: 8
    }
  }, {
    id: 33638474, coordinates: {
      galaxy: 1,
      system: 266,
      position: 11
    }
  },
  {
    id: 33638483,
    coordinates: {
      galaxy: 2,
      system: 292,
      position: 13
    }
  },
  {
    id: 33638501,
    coordinates: {
      galaxy: 1,
      system: 26,
      position: 14
    }
  },
  {
    id: 33638977,
    coordinates: {
      galaxy: 5,
      system: 147,
      position: 15
    }
  }, {
    id: 33638988, coordinates: {
      galaxy: 1,
      system: 143,
      position: 15
    }
  }
];

export class StaticGameContext extends AbstractGameContext {
  constructor() {
    super(7, 499);
  }
  getBodies(): SpaceBody[] {
    return PLANETS;
  }
  getResearches(): Researches {
    return CURRENT_RESEARCHES;
  }
}
