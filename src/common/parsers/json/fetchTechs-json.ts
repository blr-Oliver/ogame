import {TechContext} from 'ogame-api-facade';
import {ServerContext} from 'ogame-core/context/ServerContext';
import {Buildings, BuildingTypeId, Defense, DefenseTypeId, Fleet, Researches, ResearchTypeId, ShipTypeId} from 'ogame-core/types/core';
import {Fetcher} from '../../core/Fetcher';

export type TechResponse = { [techId: number]: number };

export function getTechResponse(fetcher: Fetcher, serverContext: ServerContext, cp?: number): Promise<TechResponse> {
  const query: { [key: string]: string | number } = {
    page: 'fetchTechs'
  };
  if (cp) query['cp'] = cp;
  return fetcher.fetch({
    url: serverContext.gameUrl,
    method: 'POST',
    query,
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  }).then(response => response.json());
}

export function extractContext(techs: TechResponse): TechContext {
  return {
    researches: extractResearches(techs),
    buildings: extractBuildings(techs),
    defense: extractDefence(techs),
    fleet: extractFleet(techs)
  };
}
export function extractResearches(techs: TechResponse): Researches {
  return extractFromEnum(techs, ResearchTypeId);
}

export function extractBuildings(techs: TechResponse): Buildings {
  return extractFromEnum(techs, BuildingTypeId);
}

export function extractDefence(techs: TechResponse): Defense {
  return extractFromEnum(techs, DefenseTypeId);
}

export function extractFleet(techs: TechResponse): Fleet {
  return extractFromEnum(techs, ShipTypeId);
}

function extractFromEnum<T extends { [key: string]: number }>(techs: TechResponse, enumeration: { [key: string]: string | number }): T {
  let result: { [key: string]: number } = {};
  for (let key in enumeration) {
    let techId: string | number = enumeration[key];
    if (typeof techId === 'number')
      result[key] = techs[techId] || 0;
  }
  return result as T;
}
