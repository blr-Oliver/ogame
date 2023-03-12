import {Mission} from 'ogame-core/types/core';
import {FlightEvent} from '../../uniplatform/core/types/reports';

export interface Launcher {
  launch(mission: Mission, maxAttempts?: number): Promise<unknown>;
}

export interface EventListLoader {
  loadEvents(): Promise<FlightEvent[]>;
}

export interface Mapper extends Launcher, EventListLoader {
}
