import {FlightEvent, GalaxySystemInfo, StampedEspionageReport} from './report-types';

export interface GalaxyParser {
  parseGalaxy(body: string, timestamp?: Date): GalaxySystemInfo;
}

export interface EspionageReportParser {
  parseReport(body: string): StampedEspionageReport | undefined;
  parseReportList(body: string): number[];
  parseReportListForToken(body: string): string;
}

export interface EventListParser {
  parseEventList(body: string): FlightEvent[];
}
