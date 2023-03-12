export enum CoordinateType { Planet = 1, Debris = 2, Moon = 3 }

export enum MissionType {
  Attack = 1,
  Alliance = 2,
  Transport = 3,
  Deploy = 4,
  Hold = 5,
  Espionage = 6,
  Colony = 7,
  Recycle = 8,
  Destroy = 9,
  MissileAttack = 10,
  Expedition = 15
}

export interface Coordinates {
  galaxy: number;
  system: number;
  position: number;
  type?: CoordinateType;
}

export interface SpaceBody {
  name?: string; // allow unnamed bodies
  id: number;
  coordinates: Coordinates;
  companion?: SpaceBody;
}

export enum BuildingTypeId {
  metalMine = 1,
  crystalMine = 2,
  deutMine = 3,
  solarPlant = 4,
  fusionReactor = 12,
  robotics = 14,
  nanite = 15,
  shipyard = 21,
  metalStorage = 22,
  crystalStorage = 23,
  deutStorage = 24,
  researchLab = 31,
  terraformer = 33,
  allianceDepot = 34,
  spaceDock = 36,
  lunarBase = 41,
  sensorPhalanx = 42,
  jumpGate = 43,
  missileSilo = 44
}

export enum ResearchTypeId {
  espionage = 106,
  computer = 108,
  weaponsUpgrade = 109,
  shieldingUpgrade = 110,
  armorUpgrade = 111,
  energy = 113,
  hyperspace = 114,
  combustionDrive = 115,
  impulseDrive = 117,
  hyperspaceDrive = 118,
  laser = 120,
  ion = 121,
  plasma = 122,
  intergalactic = 123,
  astrophysics = 124,
  graviton = 199
}

export enum ShipTypeId {
  smallCargo = 202,
  largeCargo = 203,
  lightFighter = 204,
  heavyFighter = 205,
  cruiser = 206,
  battleship = 207,
  colonyShip = 208,
  recycler = 209,
  espionageProbe = 210,
  bomber = 211,
  solarSatellite = 212,
  destroyer = 213,
  deathStar = 214,
  battlecruiser = 215,
  crawler = 217,
  reaper = 218,
  pathfinder = 219
}

export enum DefenseTypeId {
  rocketLauncher = 401,
  lightLaser = 402,
  heavyLaser = 403,
  gaussCannon = 404,
  ionCannon = 405,
  plasmaTurret = 406,
  smallShield = 407,
  largeShield = 408,
  antiBallistic = 502,
  interplanetary = 503
}

export type BuildingType = keyof typeof BuildingTypeId;
export type Buildings = { [key in BuildingType]: number };

export type ResearchType = keyof typeof ResearchTypeId;
export type Researches = { [key in ResearchType]: number };

export type ShipType = keyof typeof ShipTypeId;
export type Fleet = { [key in ShipType]: number };
export type FleetPartial = { [key in ShipType]?: number };

export type DefenseType = keyof typeof DefenseTypeId;
export type Defense = { [key in DefenseType]: number };
export type DefensePartial = { [key in DefenseType]?: number };

export type ResourceType =
    'metal' |
    'crystal' |
    'deuterium' |
    'energy';

export type Resources = { [key in ResourceType]?: number };

export type OneToTen = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type OneToThree = 1 | 2 | 3;
export type Speed = OneToTen;

export interface PlunderPriority {
  metal: OneToThree;
  crystal: OneToThree;
  deuterium: OneToThree;
}

export interface Mission {
  from?: number;
  to: Coordinates;
  fleet: FleetPartial;
  mission: MissionType;
  priority?: PlunderPriority;
  speed?: Speed;
  cargo?: Resources;
  holdTime?: number;
}

export type SystemCoordinates = [galaxy: number, system: number];

export type PlayerClass = 'collector' | 'general' | 'discoverer' | 'none';
export type AllianceClass = 'trader' | 'researcher' | 'warrior' | 'none';
export type InfoCategory = 'resources' | 'ships' | 'defense' | 'buildings' | 'research';
