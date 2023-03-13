import {EventListLoader, FlightEvent} from 'ogame-api-facade';
import {ServerContext} from 'ogame-core';
import {EventListParser} from '../../../uniplatform/parsers';
import {Fetcher} from '../../core/Fetcher';

export class AjaxEventListLoader implements EventListLoader {
  constructor(
      private readonly fetcher: Fetcher,
      private readonly parser: EventListParser,
      private readonly serverContext: ServerContext) {
  }

  loadEvents(): Promise<FlightEvent[]> {
    return getEventListResponse(this.fetcher, this.serverContext)
        .then(body => this.parser.parseEventList(body));
  }
}

export function getEventListResponse(fetcher: Fetcher, serverContext: ServerContext): Promise<string> {
  return fetcher.fetch({
    url: serverContext.gameUrl,
    method: 'GET',
    query: {
      page: 'componentOnly',
      component: 'eventList',
      ajax: 1
    },
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  }).then(response => response.text());
}
