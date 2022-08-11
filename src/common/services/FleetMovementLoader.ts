import {BufferedStringSource, StringSource, UTF8NonValidatingCharacterSource, XML} from 'my-xml-lite';
import {Fetcher, ResponseFacade} from '../core/Fetcher';
import {ServerContext} from '../core/ServerContext';
import {FleetMovementParser} from '../parsers';
import {MovingFleet} from '../report-types';

export class FleetMovementLoader {
  constructor(
      private readonly server: ServerContext,
      private readonly fetcher: Fetcher,
      private readonly parser: FleetMovementParser) {
  }

  async load(): Promise<MovingFleet[]> {
    const response = await this.getMovementResponse();
    const source = await this.prepareResponse(response);
    return this.parser.parseFleetMovement(XML.parse(source));
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

  private async prepareResponse(response: ResponseFacade): Promise<StringSource> {
    const buffer = await response.arrayBuffer();
    return new BufferedStringSource(new UTF8NonValidatingCharacterSource(new Uint8Array(buffer)));
  }
}