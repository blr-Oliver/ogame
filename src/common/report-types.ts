import {Buildings, Coordinates, DefensePartial, FleetPartial, Mission, MissionType, Researches, Resources} from './types';

export type ZeroOne = 0 | 1;

export interface FlightEvent {
  id: number;
  mission: MissionType;
  time: Date;
  isReturn: boolean;
  isFriendly: boolean;
  to: Coordinates;
  toName?: string;
  targetPlayerName?: string;
  targetPlayerId?: number;
  fleet: EventFleet[];
}

export interface EventFleet {
  from: Coordinates;
  fromName?: string;
  fleet: FleetPartial;
  cargo?: Resources;
}

export interface GalaxySystemInfo {
  galaxy: number;
  system: number;
  timestamp?: Date;
  empty: boolean;
  slots: Array<GalaxySlot | undefined>;
}

export interface GalaxySlot extends GalaxySlotCoordinates, GalaxySlotInfo {
}

export interface GalaxySlotCoordinates {
  galaxy: number;
  system: number;
  timestamp?: Date;
  position: number;
}

export interface GalaxySlotInfo {
  planet?: PlanetGalaxyInfo;
  moon?: MoonGalaxyInfo;
  debris?: DebrisGalaxyInfo;
  player?: PlayerGalaxyInfo;
  alliance?: AllianceGalaxyInfo;
}

export interface PlanetGalaxyInfo {
  id: number | string;
  name: string;
  active?: boolean;
  activityTime?: number;
}

export interface MoonGalaxyInfo extends PlanetGalaxyInfo {
  size: number;
}

export interface DebrisGalaxyInfo {
  metal: number;
  crystal: number;
}

export interface PlayerGalaxyInfo {
  id: number | string;
  name: string;
  rawStatus: string;
  status?: PlayerStatusInfo; // TODO make it required
  rank?: number; // some players (admins) do not have rank
}

export enum PlayerInactivity {Active = 0, Inactive = 1, InactiveLong = 2}

export interface PlayerStatusInfo {
  inactive: PlayerInactivity;
  vacation: ZeroOne;
  admin: ZeroOne;
  banned: ZeroOne;
  newbie: ZeroOne;
  honorableTarget: ZeroOne;
  strong: ZeroOne;
  outlaw: ZeroOne;
}

export interface AllianceGalaxyInfo {
  id: number | string;
  name: string;
  shortName: string;
  rank: number;
  members: number;
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
  parsedStatus: PlayerStatusInfo;

  resources: Resources;
  fleet?: FleetPartial;
  defense?: DefensePartial;
  buildings?: Buildings;
  researches?: Researches;
}

export interface StampedEspionageReport extends EspionageReport, ShardHeader {
}

export interface ShardHeader {
  id: number;
  timestamp: Date;
  infoLevel: number;
}

export interface ShardedEspionageReport extends EspionageReport {
  source: ShardHeader[];
}

export interface ObserveParams {
  pause: boolean;
  galaxyMin: number;
  galaxyMax: number;
  galaxyLast: number | null;
  systemMin: number;
  systemMax: number;
  systemLast: number | null;
  emptyTimeout: number;
  normalTimeout: number;
}

export interface Mapper {
  observe: ObserveParams;
  observeAllSystems(systems: Coordinates[]): Promise<GalaxySystemInfo[]>;
  loadAllReports(): Promise<StampedEspionageReport[]>;
  loadEvents(): Promise<FlightEvent[]>;
  launch(mission: Mission): Promise<number>;
}

export interface StringNumberMap {
  [key: string]: number;
}

export type InfoCategory = 'resources' | 'ships' | 'defense' | 'buildings' | 'research';
