import {Fetcher, ResponseFacade} from '../../core/Fetcher';
import {ServerContext} from '../../core/ServerContext';
import {FleetMovementParser} from '../../core/types/parsers';
import {XmlLiteResponseParser} from '../../parsers/xml-lite/XmlLiteResponseParser';
import {MovingFleet} from '../../core/types/reports';

export class FleetMovementLoader {
  constructor(
      private readonly server: ServerContext,
      private readonly fetcher: Fetcher,
      private readonly documentParser: XmlLiteResponseParser,
      private readonly movementParser: FleetMovementParser) {
  }

  async load(): Promise<MovingFleet[]> {
    const response = await this.getMovementResponse();
    const document = await this.documentParser.parseResponse(response);
    return this.movementParser.parseFleetMovement(document);
  }

  private async getMovementResponse(): Promise<ResponseFacade> {
    return this.fetcher.fetch({
      url: this.server.gameUrl,
      method: 'GET',
      query: {
        page: 'ingame',
        component: 'movement'
      }
    });
  }
}