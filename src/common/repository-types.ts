import {GalaxySystemInfo, ShardedEspionageReport, StampedEspionageReport} from './report-types';
import {Coordinates, CoordinateType} from './types';

export interface EspionageRepository {
  load(galaxy: number, system: number, position: number, type: CoordinateType): Promise<ShardedEspionageReport | undefined>;
  loadC(coordinates: Coordinates): Promise<ShardedEspionageReport | undefined>;
  store(report: StampedEspionageReport): Promise<void>;
  findForInactiveTargets(): Promise<[Coordinates, ShardedEspionageReport][]>;
  deleteOldReports(): Promise<void>;
}

export interface GalaxyRepository {
  load(galaxy: number, system: number): Promise<GalaxySystemInfo | undefined>;
  loadC(coordinates: Coordinates): Promise<GalaxySystemInfo | undefined>;
  findNextStale(galaxyMin: number, galaxyMax: number, systemMin: number, systemMax: number, galaxyLast: number | null, systemLast: number | null,
                normalTimeout: number, emptyTimeout: number): Promise<Coordinates | undefined>;
  findInactiveTargets(): Promise<Coordinates[]>;
  findStaleSystemsWithTargets(timeout: number): Promise<Coordinates[]>;
  store(report: GalaxySystemInfo): Promise<any>;
}
