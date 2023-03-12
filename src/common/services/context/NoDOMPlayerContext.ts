import {ServerContext} from 'ogame-core/context/ServerContext';
import {Buildings, Defense, Fleet, Researches, Resources, SpaceBody} from 'ogame-core/types/core';
import {PlayerContext} from '../../../uniplatform/core/PlayerContext';
import {TechContext} from '../../../uniplatform/core/types/reports';
import {Fetcher} from '../../core/Fetcher';
import {extractBuildings, extractContext, extractDefence, extractFleet, extractResearches, getTechResponse} from '../../parsers/json/fetchTechs-json';
import {
  getImportExportRefreshResponse,
  getImportExportResponse,
  parseImportExportForBodies,
  parseImportExportForResources
} from '../../parsers/no-dom/import-export-no-dom';

export class NoDOMPlayerContext implements PlayerContext {
  constructor(
      private readonly serverContext: ServerContext,
      private readonly fetcher: Fetcher
  ) {
  }

  getBodies(): Promise<SpaceBody[]> {
    return getImportExportResponse(this.fetcher, this.serverContext)
        .then(body => parseImportExportForBodies(body));
  }
  getResearches(): Promise<Researches> {
    return getTechResponse(this.fetcher, this.serverContext)
        .then(techs => extractResearches(techs));
  }
  getBuildings(bodyId: number): Promise<Buildings> {
    return getTechResponse(this.fetcher, this.serverContext, bodyId)
        .then(techs => extractBuildings(techs));
  }
  getDefence(bodyId: number): Promise<Defense> {
    return getTechResponse(this.fetcher, this.serverContext, bodyId)
        .then(techs => extractDefence(techs));
  }
  getFleet(bodyId: number): Promise<Fleet> {
    return getTechResponse(this.fetcher, this.serverContext, bodyId)
        .then(techs => extractFleet(techs));
  }
  getTechContext(bodyId: number): Promise<TechContext> {
    return getTechResponse(this.fetcher, this.serverContext, bodyId)
        .then(techs => extractContext(techs));
  }
  getResources(bodyId: number): Promise<Resources> {
    return getImportExportRefreshResponse(this.fetcher, this.serverContext, bodyId)
        .then(json => json.refreshPlanet.input as Resources);
  }
  getAllResources(): Promise<{ [planetId: number]: Resources }> {
    return getImportExportResponse(this.fetcher, this.serverContext)
        .then(body => parseImportExportForResources(body));
  }
}
