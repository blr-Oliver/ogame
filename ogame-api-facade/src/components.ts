import {Buildings, Coordinates, Defense, Fleet, Mission, Researches, Resources, SpaceBody} from 'ogame-core';
import {FlightEvent, GalaxySystemInfo, TechContext} from './model';

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

export interface PlayerContext {
  getBodies(): Promise<SpaceBody[]>;
  getResearches(): Promise<Researches>;
  getBuildings(bodyId: number): Promise<Buildings>;
  getFleet(bodyId: number): Promise<Fleet>;
  getDefence(bodyId: number): Promise<Defense>;
  getTechContext(bodyId: number): Promise<TechContext>;
  getResources(bodyId: number): Promise<Resources>;
  getAllResources(): Promise<{ [bodyId: number]: Resources }>;
}