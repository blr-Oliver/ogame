import {ReplyingMessageChannel} from '../common/message/ReplyingMessageChannel';
import {AutoObserveSkeleton} from '../common/remote/AutoObserveSkeleton';
import {AutoObserve} from '../common/services/AutoObserve';

export interface ClientConnection {
  autoObserveSkeleton?: AutoObserveSkeleton;
  port?: ReplyingMessageChannel;
  promise: Promise<ReplyingMessageChannel>;
}

export class ClientManager {
  private readonly connections: { [clientId: string]: ClientConnection } = {};
  // TODO this should NOT depend on AutoObserve
  constructor(private readonly shim: EventTarget,
              private readonly autoObserve: AutoObserve) {
  }

  connectIfNecessary(client: Client): ClientConnection {
    const clientId = client.id;
    // FIXME
    return this.connections[clientId];
  }
}
