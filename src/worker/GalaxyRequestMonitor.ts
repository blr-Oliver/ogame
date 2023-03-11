import {GalaxyParser} from '../uniplatform/core/types/parsers';
import {GalaxyHistoryRepository, GalaxyRepository} from '../uniplatform/core/types/repositories';
import {spyRequest} from './spy-request';

export class GalaxyRequestMonitor {
  constructor(private repo: GalaxyRepository,
              private historyRepo: GalaxyHistoryRepository,
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
          .then(galaxyInfo => Promise.all([this.repo.store(galaxyInfo), this.historyRepo.store(galaxyInfo)]));
    }
  }
}
