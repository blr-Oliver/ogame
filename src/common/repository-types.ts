import {DebrisGalaxyInfo, GalaxySlot, GalaxySlotCoordinates, GalaxySystemInfo, ShardedEspionageReport, StampedEspionageReport} from './report-types';
import {Coordinates, CoordinateType, SystemCoordinates} from './types';

export interface EspionageRepository {
  load(galaxy: number, system: number, position: number, type?: CoordinateType): Promise<ShardedEspionageReport | undefined>;
  loadC(coordinates: Coordinates): Promise<ShardedEspionageReport | undefined>;
  store(report: StampedEspionageReport): Promise<any>;
  deleteOldReports(): Promise<void>;
}

export interface GalaxyRepository {
  loadSystem(galaxy: number, system: number): Promise<GalaxySystemInfo | undefined>;
  findAllStale(normalTimeout: number, emptyTimeout: number): Promise<SystemCoordinates[]>;
  findAllMissing(maxGalaxy: number, maxSystem: number): Promise<SystemCoordinates[]>;
  findInactiveTargets(): Promise<Coordinates[]>;
  findStaleSystemsWithTargets(timeout: number): Promise<SystemCoordinates[]>;
  store(report: GalaxySystemInfo): Promise<any>;
  findAllCurrentDebris(): Promise<(GalaxySlotCoordinates & DebrisGalaxyInfo)[]>;
  findHangingDebris(): Promise<(GalaxySlotCoordinates & DebrisGalaxyInfo)[]>
  selectLatestReports(): Promise<GalaxySystemInfo[]>;
}

export interface GalaxyHistoryRepository {
  store(report: GalaxySystemInfo): Promise<any>;
  loadSlotHistory(galaxy: number, system: number, position: number): Promise<GalaxySlot[]>;
  loadSlotHistoryC(coordinates: Coordinates): Promise<GalaxySlot[]>;
  loadSlotState(galaxy: number, system: number, position: number, timestamp: Date): Promise<[GalaxySlot?, GalaxySlot?]>;
  loadSlotStateC(coordinates: Coordinates, timestamp: Date): Promise<[GalaxySlot?, GalaxySlot?]>;
  loadSystemHistory(coordinates: SystemCoordinates): Promise<unknown>; // TODO
  loadSystemState(coordinates: SystemCoordinates): Promise<[GalaxySystemInfo?, GalaxySystemInfo?]>;
  condenseHistory(galaxy: number, system: number, position: number): Promise<GalaxySlot[]>;
}
