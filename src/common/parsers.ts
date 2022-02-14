import {FlightEvent, GalaxySystemInfo, StampedEspionageReport} from './report-types';
import {Resources, SpaceBody} from './types';

export interface GalaxyParser {
  parseGalaxy(body: string, timestamp?: Date): GalaxySystemInfo;
}

export interface EspionageReportParser {
  parseReport(body: string): StampedEspionageReport | undefined;
  parseReportList(body: string): number[];
}

export interface EventListParser {
  parseEventList(body: string): FlightEvent[];
}

export interface PlanetListParser {
  parsePlanetList(body: string): SpaceBody[];
}

export interface PlanetResourcesParser {
  parseResources(body: string): { [planetId: number]: Resources };
}
