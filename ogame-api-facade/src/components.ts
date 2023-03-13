import {Coordinates, Mission} from 'ogame-core/types/core';
import {FlightEvent, GalaxySystemInfo} from './model';

export interface GalaxyObserver {
  observe(galaxy: number, system: number, parallelSave?: boolean, skipSave?: boolean): Promise<GalaxySystemInfo>;
  observeC(system: Coordinates, parallelSave?: boolean, skipSave?: boolean): Promise<GalaxySystemInfo>;
}

export interface Launcher {
  launch(mission: Mission, maxAttempts?: number): Promise<unknown>;
}

export interface EventListLoader {
  loadEvents(): Promise<FlightEvent[]>;
}