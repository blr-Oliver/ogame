import {Document} from 'my-xml-lite';
import {FlightEvent, GalaxySystemInfo, MovingFleet, StampedEspionageReport} from 'ogame-api-facade';
import {EspionageReportList} from '../../../common/parsers/no-dom/espionage-report-no-dom';

// TODO all these should accept ResponseFacade

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

export interface FleetMovementParser {
  parseFleetMovement(body: Document): MovingFleet[];
}