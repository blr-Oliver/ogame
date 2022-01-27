import {ReplyingMessageEvent, ReplyingMessagePort} from '../common/message/ReplyingMessagePort';

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

let clientConnections: { [clientId: string]: ClientExchange } = {};

let shim = new DelegatingEventTarget();
self.addEventListener('message', e => shim.handleEvent(e));
self.addEventListener('fetch', (e: FetchEvent) => {
  const clientId = e.clientId;
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
                connection.onmessage = (e: ReplyingMessageEvent) => {
                  let s = String(e.data);
                  console.log(`In service worker from client: ${s}`);
                  e.reply(s.split('').reverse().join(''), true);
                }
              });
            }
          }
        });
  }
});
