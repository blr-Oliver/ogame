import {GalaxySystemInfo, ShardedEspionageReport, StampedEspionageReport} from './report-types';
import {Coordinates, CoordinateType} from './types';

export interface EspionageRepository {
  load(galaxy: number, system: number, position: number, type?: CoordinateType): Promise<ShardedEspionageReport | undefined>;
  loadC(coordinates: Coordinates): Promise<ShardedEspionageReport | undefined>;
  store(report: StampedEspionageReport): Promise<any>;
  findForInactiveTargets(): Promise<ShardedEspionageReport[]>;
  deleteOldReports(): Promise<void>;
}

export interface GalaxyRepository {
  load(galaxy: number, system: number): Promise<GalaxySystemInfo | undefined>;
  loadC(coordinates: Coordinates): Promise<GalaxySystemInfo | undefined>;
  findNextStale(fromGalaxy: number, toGalaxy: number, fromSystem: number, toSystem: number, normalTimeout: number, emptyTimeout: number,
                galaxyLast?: number, systemLast?: number): Promise<Coordinates | undefined>;
  findNextMissing(fromGalaxy: number, toGalaxy: number, fromSystem: number, toSystem: number, maxSystem: number,
                  galaxyLast?: number, systemLast?: number): Promise<Coordinates | undefined>;
  findInactiveTargets(): Promise<Coordinates[]>;
  findStaleSystemsWithTargets(timeout: number): Promise<Coordinates[]>;
  store(report: GalaxySystemInfo): Promise<any>;
}
