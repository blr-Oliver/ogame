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
  load(galaxy: number, system: number): Promise<GalaxySystemInfo | null>;
  loadC(coordinates: Coordinates): Promise<GalaxySystemInfo | null>;
  findNextStale(galaxyMin: number, galaxyMax: number, systemMin: number, systemMax: number, galaxyLast: number | null, systemLast: number | null,
                normalTimeout: number, emptyTimeout: number): Promise<Coordinates>;
  findInactiveTargets(): Promise<Coordinates[]>;
  findStaleSystemsWithTargets(timeout: number): Promise<Coordinates[]>;
  store(galaxy: GalaxySystemInfo): Promise<void>;
}
