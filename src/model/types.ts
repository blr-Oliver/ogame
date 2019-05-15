export enum CoordinateType { Planet = 1, Debris = 2, Moon = 3 }

export enum MissionType {
  Attack = 1,
  Alliance = 2,
  Transport = 3,
  Leave = 4,
  Hold = 5,
  Espionage = 6,
  Colony = 7,
  Recycle = 8,
  Destroy = 9,
  Expedition = 15
}

export enum FleetType {
  LightFighter = 'am204',
  HeavyFighter = 'am205',
  Cruiser = 'am206',
  Battleship = 'am207',
  Battlecruiser = 'am215',
  Bomber = 'am211',
  Destroyer = 'am213',
  DeathStart = 'am214',
  SmallCargo = 'am202',
  LargeCargo = 'am203',
  ColonyShip = 'am208',
  Recycler = 'am209',
  EspionageProbe = 'am210',
  SolarSatellite = 'am212'
}

export interface Coordinates {
  galaxy: number;
  system: number;
  position: number;
  type?: CoordinateType;
}

export interface Researches {
  energy: number;
  laser: number;
  ion: number;
  hyperspace: number;
  plasma: number;
  espionage: number;
  computer: number;
  astrophysics: number;
  intergalactic: number;
  graviton: number;
  combustionDrive: number;
  impulseDrive: number;
  hyperspaceDrive: number;
  weaponsUpgrade: number;
  shieldingUpgrade: number;
  armorUpgrade: number;
}

export interface Buildings {
  metalMine: number;
  crystalMine: number;
  deutMine: number;
  metalStorage: number;
  crystalStorage: number;
  deutStorage: number;
  solarPlant: number;
  fusionReactor: number;
  robotics: number;
  nanite: number;
  shipyard: number;
  researchLab: number;
  terraformer: number;
  allianceDepot: number;
  missileSilo: number;
  spaceDock: number;
  lunarBase: number;
  sensorPhalanx: number;
  jumpGate: number;
}

export interface Defense {
  rocketLauncher: number;
  lightLaser: number;
  heavyLaser: number;
  ionCannon: number;
  gaussCannon: number;
  plasmaTurret: number;
  smallShield: number;
  largeShield: number;
  antiBallistic: number;
  interplanetary: number;
}

export interface Fleet {
  lightFighter: number;
  heavyFighter: number;
  cruiser: number;
  battleship: number;
  battlecruiser: number;
  bomber: number;
  destroyer: number;
  deathStar: number;
  smallCargo: number;
  largeCargo: number;
  colonyShip: number;
  recycler: number;
  espionageProbe: number;
  solarSatellite: number;
}

export interface Resources {
  metal: number;
  crystal: number;
  deut: number;
  energy: number;
}

export interface PlanetActivity {
  active: boolean;
  time?: number;
}

export interface EspionageReport {
  infoLevel: number;
  coordinates: Coordinates;
  planetName: string;
  playerName: string;
  playerStatus: string;
  counterEspionage: number;
  activity: PlanetActivity;

  resources: Resources;
  fleet?: Fleet;
  defense?: Defense;
  buildings?: Buildings;
  researches?: Researches;
}

export interface StampedEspionageReport extends EspionageReport {
  id: number;
  timestamp: Date;
}

export interface ShardHeader {
  id: number;
  timestamp: Date;
  infoLevel: number;
}

export interface ShardedEspionageReport extends EspionageReport {
  source: ShardHeader[];
}

export type OneToTen = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Speed = OneToTen;

export interface Mission {
  from?: number;
  to: Coordinates;
  fleet: { [key in FleetType]?: number };
  mission: MissionType;
  speed?: Speed;
  cargo?: Resources;
  holdTime?: number;
}
