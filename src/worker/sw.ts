import {extractGalaxy} from '../browser/parsers/galaxy-report-extractor';
import {IDBRepositoryProvider} from '../common/idb/IDBRepositoryProvider';
import {IDBGalaxyRepository} from '../common/idb/repositories/IDBGalaxyRepository';
import {IDBGalaxyRepositorySupport} from '../common/idb/repositories/IDBGalaxyRepositorySupport';
import {ReplyingMessagePort} from '../common/message/ReplyingMessagePort';

declare var self: ServiceWorkerGlobalScope;

class DelegatingEventTarget extends EventTarget {
  constructor() {
    super();
  }
  handleEvent(e: Event) {
    // @ts-ignore
    let clone = new e.constructor(e.type, e);
    this.dispatchEvent(clone);
  }
}

interface ClientExchange {
  connection?: ReplyingMessagePort;
  promise: Promise<ReplyingMessagePort>;
}

interface RequestCapture {
  request: Request;
  response: Response;
}

let clientConnections: { [clientId: string]: ClientExchange } = {};
let shim = new DelegatingEventTarget();

const galaxySupport = new IDBGalaxyRepositorySupport();
const repositoryProvider: IDBRepositoryProvider = new IDBRepositoryProvider(self.indexedDB, 'ogame', {
  'galaxy': galaxySupport
});

self.addEventListener('message', e => shim.handleEvent(e));
self.addEventListener('fetch', (e: FetchEvent) => {
  const clientId = e.clientId;
  maybeConnect(clientId);
  spyGalaxyRequest(e);
});

function maybeConnect(clientId: string) {
  if (!(clientId in clientConnections)) {
    self.clients.get(clientId)
        .then(client => {
          if (client) {
            if (clientConnections[clientId] == null) {
              let exchange: ClientExchange = clientConnections[clientId] = {
                promise: ReplyingMessagePort.connect('exchange', client, shim)
              };
              exchange.promise.then(connection => {
                exchange.connection = connection;
              });
            }
          }
        });
  }
}

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
