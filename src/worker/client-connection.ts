import {ReplyingMessagePort} from '../common/message/ReplyingMessagePort';

export interface ClientExchange {
  connection?: ReplyingMessagePort;
  promise: Promise<ReplyingMessagePort>;
}

export const clientConnections: { [clientId: string]: ClientExchange } = {};

export function maybeConnect(clientId: string, self: ServiceWorkerGlobalScope, shim: EventTarget) {
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
