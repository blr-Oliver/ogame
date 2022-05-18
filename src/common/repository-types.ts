import {DebrisGalaxyInfo, GalaxySlotCoordinates, GalaxySystemInfo, ShardedEspionageReport, StampedEspionageReport} from './report-types';
import {Coordinates, CoordinateType, SystemCoordinates} from './types';

export interface EspionageRepository {
  load(galaxy: number, system: number, position: number, type?: CoordinateType): Promise<ShardedEspionageReport | undefined>;
  loadC(coordinates: Coordinates): Promise<ShardedEspionageReport | undefined>;
  store(report: StampedEspionageReport): Promise<any>;
  deleteOldReports(): Promise<void>;
}

export interface GalaxyRepository {
  load(galaxy: number, system: number): Promise<GalaxySystemInfo | undefined>;
  loadC(coordinates: Coordinates): Promise<GalaxySystemInfo | undefined>;
  findNextStale(normalTimeout: number, emptyTimeout: number, from?: SystemCoordinates): Promise<Coordinates | undefined>;
  findAllStale(normalTimeout: number, emptyTimeout: number): Promise<Coordinates[]>;
  findNextMissing(maxGalaxy: number, maxSystem: number, from?: SystemCoordinates): Promise<Coordinates | undefined>
  findAllMissing(maxGalaxy: number, maxSystem: number): Promise<Coordinates[]>;
  findInactiveTargets(): Promise<Coordinates[]>;
  findStaleSystemsWithTargets(timeout: number): Promise<Coordinates[]>;
  store(report: GalaxySystemInfo): Promise<any>;
  findAllCurrentDebris(): Promise<(GalaxySlotCoordinates & DebrisGalaxyInfo)[]>;
}
