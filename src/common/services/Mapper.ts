import {FlightEvent} from '../core/types/reports';
import {Mission} from '../core/types/core';

export interface Launcher {
  launch(mission: Mission, maxAttempts?: number): Promise<unknown>;
}

export interface EventListLoader {
  loadEvents(): Promise<FlightEvent[]>;
}

export interface Mapper extends Launcher, EventListLoader {
}
