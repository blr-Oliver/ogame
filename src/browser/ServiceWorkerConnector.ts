import {ChannelFactory} from '../common/message/ReplyingMessageChannel';
import {WaitingRequestMessageChannel} from '../common/message/WaitingRequestMessageChannel';

export class ServiceWorkerConnector implements ChannelFactory<any, any> {
  constructor(private readonly idProvider: () => Promise<string>) {
  }

  connect(): Promise<WaitingRequestMessageChannel> {
    return new Promise<WaitingRequestMessageChannel>(async (resolve, reject) => {
      console.debug(`ServiceWorkerConnector#connect: waiting for service worker`);
      await navigator.serviceWorker.ready;
      let id = await this.idProvider();
      let acceptListener = (e: MessageEvent) => this.handleMessage(e, acceptListener, resolve, reject);
      navigator.serviceWorker.addEventListener('message', acceptListener);
      console.debug(`ServiceWorkerConnector#connect: [${id}] sending connect message`);
      navigator.serviceWorker.controller!.postMessage({
        type: 'connect',
        id
      });
    });
  }

  private handleMessage(e: MessageEvent<any>, acceptListener: (e: MessageEvent) => void, resolve: (channel: WaitingRequestMessageChannel) => void, reject: (error: any) => void) {
    const data = e.data;
    if ('type' in data && data['type'] === 'accept') {
      console.debug(`ServiceWorkerConnector#handleMessage: received accept message`);
      navigator.serviceWorker.removeEventListener('message', acceptListener);
      this.createChannel(data)
          .then(resolve, reject);
    }
  }

  private async createChannel(data: any): Promise<WaitingRequestMessageChannel> {
    const remoteId: string = data.id;
    const port: MessagePort = data.port;
    const id = await this.idProvider();
    console.debug(`ServiceWorkerConnector#createChannel: initiating handshake [${id} -> ${remoteId}]`);
    return WaitingRequestMessageChannel.connect(port, `${id}|${remoteId}`, 3600 * 1000)
        .then(replyChannel => {
          console.debug(`ServiceWorkerConnector#createChannel: channel ready`);
          this.setupChannel(replyChannel);
          return replyChannel;
        });
  }

  private setupChannel(replyChannel: WaitingRequestMessageChannel) {
    // nothing for now
  }
}
