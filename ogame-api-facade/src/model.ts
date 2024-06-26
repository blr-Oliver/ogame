import {AllianceClass, Buildings, Coordinates, Defense, DefensePartial, Fleet, FleetPartial, MissionType, PlayerClass, Researches, Resources} from 'ogame-core';

export type ZeroOne = 0 | 1;

export interface MovingFleet {
  id: number;
  mission: MissionType;
  isReturn: boolean;
  arrivalTime: number;
  from: Coordinates;
  to: Coordinates;
  fleet: FleetPartial;
  cargo?: Resources;
  recallToken?: string;
  unionId?: number;
  unionName?: string;
}

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

export enum GalaxyClass {
  Unknown = -1,
  Empty = 0,
  Debris = 1,
  NonPlayer = 2,
  Vacation = 3,
  Player = 4
}

export interface GalaxySystemHeader {
  galaxy: number;
  system: number;
  timestamp?: Date;
  empty: boolean;
  class: GalaxyClass;
}

export interface GalaxySystemInfo extends GalaxySystemHeader {
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
  class: GalaxyClass;
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
  rawStatus?: string;
  status: PlayerStatusInfo;
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
  members?: number;
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
  playerClass: PlayerClass;
  allianceClass: AllianceClass;
  loot?: number;

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
  apiKey: string;
}

export interface ShardedEspionageReport extends EspionageReport {
  source: ShardHeader[];
}

export interface TechContext {
  researches: Researches;
  buildings: Buildings;
  defense: Defense;
  fleet: Fleet;
}

export interface EspionageBriefHeader {
  id: number;
  timestamp: Date;
  coordinates: Coordinates;
  planetName: string;
}

export interface EspionageBriefContent {
  playerName: string;
  playerStatus: string;
  playerClass?: string;
  playerAllianceClass?: string;
  activity: PlanetActivity;
  counterEspionage: number;
  loot: number;
  infoLevel: number;
}

export interface EspionageBrief {
  header: EspionageBriefHeader;
  isCounterEspionage: boolean;
  content?: EspionageBriefContent;
  // TODO add content section for counter-espionage report
}

export interface EspionageReportList {
  token: string;
  page: number;
  totalPages: number;
  reports: EspionageBrief[];
}

export type TechResponse = { [techId: number]: number };
