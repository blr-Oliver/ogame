import {ServerContext} from 'ogame-core';
import {Fetcher, ResponseFacade} from '../../core/Fetcher';
import {extractGlobalVars, extractMetaValues} from '../../parsers/xml-lite/fleet-page';
import {XmlLiteResponseParser} from '../../parsers/xml-lite/XmlLiteResponseParser';

export interface FleetPageInfo {
  globalVars: { [key: string]: any };
  meta: { [key: string]: string };
}

export class FleetPageInfoLoader {
  constructor(private readonly server: ServerContext,
              private readonly fetcher: Fetcher,
              private readonly documentParser: XmlLiteResponseParser
  ) {
  }

  async load(): Promise<FleetPageInfo> {
    const response = await this.getFleetPageResponse();
    const document = await this.documentParser.parseResponse(response);
    const globalVars = extractGlobalVars(document);
    const meta = extractMetaValues(document);
    return {globalVars, meta};
  }

  private async getFleetPageResponse(): Promise<ResponseFacade> {
    return this.fetcher.fetch({
      url: this.server.gameUrl,
      method: 'GET',
      query: {
        page: 'ingame',
        component: 'fleetdispatch'
      }
    })
  }
}