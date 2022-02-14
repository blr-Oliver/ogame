import {AbstractGameContext} from '../common/core/GameContext';
import {Researches, SpaceBody} from '../common/types';

const researches: Researches = {
  energy: 0,
  laser: 0,
  ion: 0,
  hyperspace: 0,
  plasma: 0,
  espionage: 0,
  computer: 0,
  astrophysics: 0,
  intergalactic: 0,
  graviton: 0,
  combustionDrive: 0,
  impulseDrive: 0,
  hyperspaceDrive: 0,
  weaponsUpgrade: 0,
  shieldingUpgrade: 0,
  armorUpgrade: 0
}

const bodies: SpaceBody[] = [
  {
    id: 33807552,
    name: 'Homeworld',
    coordinates: {
      galaxy: 7,
      system: 337,
      position: 10
    }
  }
]

export class NavigatorGameContext extends AbstractGameContext {
  constructor() {
    super(9, 499);
  }
  getResearches(): Researches {
    return researches;
  }
  getBodies(): SpaceBody[] {
    return bodies;
  }
}
