import {AsyncSupplier} from '../common/functional';
import {GalaxyParser} from '../common/parsers';
import {GalaxyRepository} from '../common/repository-types';
import {spyRequest} from './spy-request';

export class GalaxyRequestMonitor {
  constructor(private repo: AsyncSupplier<GalaxyRepository>,
              private parser: GalaxyParser) {
  }

  spyGalaxyRequest(e: FetchEvent) {
    let request = e.request;
    let url = new URL(request.url);
    if (request.method.toLowerCase() === 'post'
        && url.pathname === '/game/index.php'
        && url.searchParams.get('ajax') === '1'
        && url.searchParams.get('asJson') === '1'
        && url.searchParams.get('component') === 'galaxy'
    ) {
      spyRequest(e, false)
          .then(({response}) => {
            let timestamp: Date = response!.headers.has('date') ? new Date(response!.headers.get('date')!) : new Date();
            return response!.text()
                .then(rawData => this.parser.parseGalaxy(rawData, timestamp));
          })
          .then(async galaxyInfo => (await this.repo()).store(galaxyInfo));
    }
  }
}
