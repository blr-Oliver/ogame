import {ReplyingMessagePort} from '../common/message/ReplyingMessagePort';
import {AutoObserveSkeleton} from '../common/remote/AutoObserveSkeleton';
import {AutoObserve} from '../common/services/AutoObserve';

export interface ClientConnection {
  autoObserveSkeleton?: AutoObserveSkeleton;
  port?: ReplyingMessagePort;
  promise: Promise<ReplyingMessagePort>;
}

export class ClientManager {
  private readonly connections: { [clientId: string]: ClientConnection } = {};
  // TODO this should NOT depend on AutoObserve
  constructor(private readonly shim: EventTarget,
              private readonly autoObserve: AutoObserve) {
  }

  connectIfNecessary(client: Client): ClientConnection {
    const clientId = client.id;
    if (clientId in this.connections) return this.connections[clientId];
    let promise = ReplyingMessagePort.connect('exchange', client, this.shim);
    let connection: ClientConnection = {
      promise: promise
          .then(port => {
            connection.port = port;
            connection.autoObserveSkeleton = new AutoObserveSkeleton(port, this.autoObserve);
            return port;
          })
    }
    return this.connections[clientId] = connection;
  }
}
