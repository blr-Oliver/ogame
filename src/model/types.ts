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

export interface Coordinates {
  galaxy: number;
  system: number;
  position: number;
  type?: CoordinateType;
}

export type ResearchType =
    'energy' |
    'laser' |
    'ion' |
    'hyperspace' |
    'plasma' |
    'espionage' |
    'computer' |
    'astrophysics' |
    'intergalactic' |
    'graviton' |
    'combustionDrive' |
    'impulseDrive' |
    'hyperspaceDrive' |
    'weaponsUpgrade' |
    'shieldingUpgrade' |
    'armorUpgrade';
export type Researches = { [key in ResearchType]: number };

export const CURRENT_RESEARCHES: Researches = {
  energy: 12,
  laser: 12,
  ion: 5,
  hyperspace: 8,
  plasma: 7,
  espionage: 10,
  computer: 12,
  astrophysics: 11,
  intergalactic: 4,
  graviton: 0,
  combustionDrive: 10,
  impulseDrive: 7,
  hyperspaceDrive: 7,
  weaponsUpgrade: 9,
  shieldingUpgrade: 10,
  armorUpgrade: 9
};

export type BuildingType =
    'metalMine' |
    'crystalMine' |
    'deutMine' |
    'metalStorage' |
    'crystalStorage' |
    'deutStorage' |
    'solarPlant' |
    'fusionReactor' |
    'robotics' |
    'nanite' |
    'shipyard' |
    'researchLab' |
    'terraformer' |
    'allianceDepot' |
    'missileSilo' |
    'spaceDock' |
    'lunarBase' |
    'sensorPhalanx' |
    'jumpGate';
export type Buildings = { [key in BuildingType]: number };

export type DefenseType =
    'rocketLauncher' |
    'lightLaser' |
    'heavyLaser' |
    'ionCannon' |
    'gaussCannon' |
    'plasmaTurret' |
    'smallShield' |
    'largeShield' |
    'antiBallistic' |
    'interplanetary';
export type Defense = { [key in DefenseType]: number };
export type DefensePartial = { [key in DefenseType]?: number };

export enum ShipTypeId {
  lightFighter = 'am204',
  heavyFighter = 'am205',
  cruiser = 'am206',
  battleship = 'am207',
  battlecruiser = 'am215',
  bomber = 'am211',
  destroyer = 'am213',
  deathStar = 'am214',
  smallCargo = 'am202',
  largeCargo = 'am203',
  colonyShip = 'am208',
  recycler = 'am209',
  espionageProbe = 'am210',
  solarSatellite = 'am212'
}

export type ShipType = keyof typeof ShipTypeId;
export type Fleet = { [key in ShipType]: number };
export type FleetPartial = { [key in ShipType]?: number };

export type ResourceType =
    'metal' |
    'crystal' |
    'deut' |
    'energy';

export type Resources = { [key in ResourceType]?: number };

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
  fleet?: FleetPartial;
  defense?: DefensePartial;
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
  fleet?: Fleet;
  defense?: Defense;
}

export type OneToTen = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Speed = OneToTen;

export interface Mission {
  from?: number;
  to: Coordinates;
  fleet: FleetPartial;
  mission: MissionType;
  speed?: Speed;
  cargo?: Resources;
  holdTime?: number;
}
