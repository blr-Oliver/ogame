import {FlightEvent} from '../report-types';
import {Mission} from '../types';

export interface Launcher {
  launch(mission: Mission): Promise<unknown>;
}

export interface Mapper extends Launcher {
  loadEvents(): Promise<FlightEvent[]>;
}
