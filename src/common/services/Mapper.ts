import {FlightEvent} from '../report-types';
import {Mission} from '../types';

export interface Launcher {
  launch(mission: Mission, maxAttempts?: number): Promise<unknown>;
}

export interface EventListLoader {
  loadEvents(): Promise<FlightEvent[]>;
}

export interface Mapper extends Launcher, EventListLoader {
}
