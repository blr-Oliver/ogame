import {ServerContext} from 'ogame-core/context/ServerContext';
import {EventListParser} from '../../../uniplatform/core/types/parsers';
import {FlightEvent} from '../../../uniplatform/core/types/reports';
import {Fetcher} from '../../core/Fetcher';
import {EventListLoader} from '../Mapper';

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
