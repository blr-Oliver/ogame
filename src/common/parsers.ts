import {EspionageReportList} from '../browser/parsers/no-dom/espionage-report-no-dom';
import {FlightEvent, GalaxySystemInfo, StampedEspionageReport} from './report-types';

export interface GalaxyParser {
  parseGalaxy(body: string, timestamp?: Date): GalaxySystemInfo;
}

export interface EspionageReportParser {
  parseReport(body: string): StampedEspionageReport | undefined;
  parseReportList(body: string): EspionageReportList;
}

export interface EventListParser {
  parseEventList(body: string): FlightEvent[];
}
