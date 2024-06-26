import {ReplyingMessageChannel, WaitingRequestMessageChannel} from 'ogame-message-channel';
import {AutoObserveSkeleton} from '../common/remote/AutoObserveSkeleton';
import {AutoObserve} from '../common/services/AutoObserve';

export interface ClientContext {
  client: Client;
  remoteId?: string;
  channel?: ReplyingMessageChannel;
  // TODO attachment to the context should be event-based
  autoObserve?: AutoObserveSkeleton;
}

export class ClientManager {
  readonly clients = new Map<string, ClientContext>();

  constructor(private readonly self: ServiceWorkerGlobalScope,
              private readonly locks: LockManager,
              private readonly selfId: string,
              private readonly autoObserve: AutoObserve) {
    self.addEventListener('fetch', event => this.monitorFetchEvent(event));
    self.addEventListener('message', event => this.monitorMessageEvent(event));
  }

  private monitorFetchEvent(event: FetchEvent) {
    const clientId = event.clientId || event.resultingClientId;
    let actions: Promise<any>[] = [];
    if (!this.clients.has(clientId)) {
      // console.debug(`New client encountered: ${clientId}`);
      let setClient = this.self.clients.get(clientId).then(client => {
        if (client && !this.clients.has(clientId)) this.clients.set(clientId, {client});
      });
      actions.push(setClient);
    }
    // actions.push(this.reportStatus());

    event.waitUntil(Promise.all(actions));
  }

  private reportStatus(): Promise<void> {
    return this.locks.query()
        .then(({held, pending}) => {
          console.debug('Held locks as visible by service worker:', held);
          console.debug('Pending locks as visible by service worker:', pending);
          console.debug('Active client contexts:', this.clients);
        });
  }

  private monitorMessageEvent(event: ExtendableMessageEvent) {
    const data = event.data;
    const client = event.source as Client;
    if ('type' in data && data.type === 'connect') {
      this.acceptClient(data, client);
    }
  }

  private acceptClient(data: any, client: Client) {
    const remoteId: string = data['id'];
    const localId = client.id;
    // console.debug(`Matched local clientId with remote clientId: ${localId} -> ${remoteId}`);
    this.installWatchDog(localId, remoteId);

    let clientContext: ClientContext;
    if (this.clients.has(localId))
      clientContext = this.clients.get(localId)!;
    else
      this.clients.set(localId, clientContext = {client});
    clientContext.remoteId = remoteId;

    this.createReplyingChannel(client, clientContext);
  }

  private createReplyingChannel(client: Client, clientContext: ClientContext) {
    let {port1: localPort, port2: remotePort} = new MessageChannel();
    client.postMessage({
      type: 'accept',
      id: this.selfId,
      port: remotePort
    }, [remotePort]);
    WaitingRequestMessageChannel.connect(localPort, `${this.selfId}|${clientContext.remoteId}`, 3600 * 1000)
        .then(
            channel => this.setupChannel(channel, clientContext),
            error => console.error('timeout connecting in service worker'));
  }

  private setupChannel(channel: ReplyingMessageChannel, clientContext: ClientContext) {
    if (clientContext.channel) {
      clientContext.channel.close();
      delete clientContext.channel;
    }
    clientContext.channel = channel;
    clientContext.autoObserve = new AutoObserveSkeleton(channel, this.autoObserve);
    channel.addEventListener('disconnect', e => {
      // console.debug(`${clientContext.client.id} disconnected`);
      if (clientContext.channel === channel) {
        delete clientContext.channel;
        delete clientContext.autoObserve;
      }
    });
  }

  private installWatchDog(localId: string, lockName: string) {
    this.locks.request(lockName, {mode: 'exclusive', ifAvailable: false}, () => {
      // console.debug(`Watchdog triggered for ${lockName}`);
      this.clients.delete(localId);
      return Promise.resolve();
    });
  }
}
