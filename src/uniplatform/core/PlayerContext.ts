import {TechContext} from 'ogame-api-facade';
import {Buildings, Defense, Fleet, Researches, Resources, SpaceBody} from 'ogame-core/types/core';

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
