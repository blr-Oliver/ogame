import {extractGalaxy, JSONGalaxyParser} from '../browser/parsers/galaxy-report-extractor';
import {NativeFetcher} from '../common/core/NativeFetcher';
import {IDBRepositoryProvider} from '../common/idb/IDBRepositoryProvider';
import {IDBGalaxyRepository} from '../common/idb/repositories/IDBGalaxyRepository';
import {IDBGalaxyRepositorySupport} from '../common/idb/repositories/IDBGalaxyRepositorySupport';
import {GalaxyRepository} from '../common/repository-types';
import {GalaxyObserver} from '../common/services/GalaxyObserver';
import {DelegatingEventTarget} from './DelegatingEventTarget';
import {LocationServerContext} from './LocationServerContext';
import {NavigatorGameContext} from './NavigatorGameContext';

declare var self: ServiceWorkerGlobalScope;

interface RequestCapture {
  request: Request;
  response: Response;
}

const shim = new DelegatingEventTarget();
const galaxySupport = new IDBGalaxyRepositorySupport();
const repositoryProvider: IDBRepositoryProvider = new IDBRepositoryProvider(self.indexedDB, 'ogame', {
  'galaxy': galaxySupport
});
const serverContext = new LocationServerContext(self.location);
const gameContext = new NavigatorGameContext();
const fetcher = new NativeFetcher();
const galaxyParser = new JSONGalaxyParser();
let galaxyRepo: GalaxyRepository;
let galaxyObserver: GalaxyObserver;

repositoryProvider.getRepository<IDBGalaxyRepository>('galaxy')
    .then(repo => {
      galaxyRepo = repo;
      return galaxyObserver = new GalaxyObserver(galaxyRepo, galaxyParser, fetcher, serverContext, gameContext);
    })
    .then(observer => {
      observer.settings.pause = false;
      observer.continueObserve();
    });

self.addEventListener('message', e => shim.handleEvent(e));
self.addEventListener('fetch', (e: FetchEvent) => {
  spyGalaxyRequest(e);
});

function spyGalaxyRequest(e: FetchEvent) {
  let request = e.request;
  let url = new URL(request.url);
  if (request.method.toLowerCase() === 'post'
      && url.pathname === '/game/index.php'
      && url.searchParams.get('ajax') === '1'
      && url.searchParams.get('asJson') === '1'
      && url.searchParams.get('component') === 'galaxy'
  ) {
    spyRequest(e)
        .then(({response}) => {
          let timestamp: Date = response.headers.has('date') ? new Date(response.headers.get('date')!) : new Date();
          return response.json()
              .then(rawData => extractGalaxy(rawData, timestamp));
        })
        .then(galaxyInfo =>
            repositoryProvider.getRepository<IDBGalaxyRepository>('galaxy')
                .then(repo => repo.store(galaxyInfo))
        );
  }
}

function spyRequest(e: FetchEvent): Promise<RequestCapture> {
  return new Promise<RequestCapture>((resolve, reject) => {
    let reqClone = e.request.clone(), resClone: Response;
    let responsePromise = fetch(e.request).then(response => {
      resClone = response.clone();
      return response;
    });
    responsePromise
        .then(() => resolve({
          request: reqClone,
          response: resClone
        }))
        .catch(e => reject(e));
    e.respondWith(responsePromise);
  });
}
