import {ChannelFactory} from '../common/message/ReplyingMessageChannel';
import {WaitingRequestMessageChannel} from '../common/message/WaitingRequestMessageChannel';

export class ServiceWorkerConnector implements ChannelFactory<any, any> {
  constructor(private readonly idProvider: () => Promise<string>) {
  }

  connect(): Promise<WaitingRequestMessageChannel> {
    return new Promise<WaitingRequestMessageChannel>(async (resolve, reject) => {
      let reg = await navigator.serviceWorker.ready;
      let id = await this.idProvider();
      let acceptListener = (e: MessageEvent) => this.handleMessage(e, acceptListener, resolve, reject);
      navigator.serviceWorker.addEventListener('message', acceptListener);
      reg.active!.postMessage({
        type: 'connect',
        id
      });
    });
  }

  private handleMessage(e: MessageEvent<any>, acceptListener: (e: MessageEvent) => void, resolve: (channel: WaitingRequestMessageChannel) => void, reject: (error: any) => void) {
    const data = e.data;
    if ('type' in data && data['type'] === 'accept') {
      navigator.serviceWorker.removeEventListener('message', acceptListener);
      this.createChannel(data)
          .then(resolve, reject);
    }
  }

  private async createChannel(data: any): Promise<WaitingRequestMessageChannel> {
    const remoteId: string = data.id;
    const port: MessagePort = data.port;
    const id = await this.idProvider();
    return WaitingRequestMessageChannel.connect(port, `${id}|${remoteId}`, 3600 * 1000)
        .then(replyChannel => {
          this.setupChannel(replyChannel);
          return replyChannel;
        });
  }

  private setupChannel(replyChannel: WaitingRequestMessageChannel) {
    // nothing for now
  }
}
