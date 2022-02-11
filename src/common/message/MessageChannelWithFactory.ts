import {ReconnectableReplyingMessageChannel} from './ReconnectableReplyingMessageChannel';
import {ChannelFactory, ReplyingMessageChannel, ReplyingMessagePortEventMap, Transferable} from './ReplyingMessageChannel';
import {ReplyingMessageEvent} from './ReplyingMessageEvent';

export interface Options {
  lazy?: boolean;
  auto?: boolean;
}

export class MessageChannelWithFactory<R = any, L = any> extends EventTarget implements ReconnectableReplyingMessageChannel<R, L> {
  private readonly options: Options;
  private channel?: ReplyingMessageChannel<R, L>;
  private connecting?: Promise<ReplyingMessageChannel<R, L>>;

  constructor(private readonly factory: ChannelFactory<R, L>, options?: Options) {
    super();
    this.options = Object.assign({
      lazy: false,
      auto: true
    }, options);
    if (this.options.lazy) this.options.auto = false;
    if (!this.options.lazy)
      this.reconnect();
  }

  postMessage(message: L, ignoreReply: true, transfer?: Transferable[]): void;
  postMessage(message: L, ignoreReply?: false, transfer?: Transferable[]): Promise<ReplyingMessageEvent<R, L>>;
  postMessage(message: L, ignoreReply?: boolean, transfer?: Transferable[]): Promise<ReplyingMessageEvent<R, L>> | void;
  postMessage(message: L, ignoreReply?: boolean, transfer?: Transferable[]): Promise<ReplyingMessageEvent<R, L>> | void {
    // TODO can it be folded into single line?
    if (ignoreReply)
      this.connect().then(channel => channel.postMessage(message, true, transfer));
    else
      return this.connect().then(channel => channel.postMessage(message, false, transfer));
  }

  addEventListener<K extends keyof ReplyingMessagePortEventMap>(type: K,
                                                                listener: (this: ReconnectableReplyingMessageChannel<R, L>, ev: ReplyingMessagePortEventMap[K]) => any,
                                                                options?: AddEventListenerOptions | boolean): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean): void {
    super.addEventListener(type, listener, options);
  }

  removeEventListener<K extends keyof ReplyingMessagePortEventMap>(type: K,
                                                                   listener: (this: ReconnectableReplyingMessageChannel<R, L>, ev: ReplyingMessagePortEventMap[K]) => any,
                                                                   options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
    super.removeEventListener(type, listener, options);
  }

  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = undefined;
      this.dispatchUnrecovered('close');
    }
  }

  reconnect(): Promise<ReconnectableReplyingMessageChannel<R, L>> {
    if (this.channel) {
      console.debug(`MessageChannelWithFactory#reconnect: closing current channel`);
      this.channel.close();
      this.channel = undefined;
    }

    return this.connect()
        .then(() => this);
  }

  private connect(): Promise<ReplyingMessageChannel<R, L>> {
    if (this.channel) {
      console.debug(`MessageChannelWithFactory#connect: already connected`);
      return Promise.resolve(this.channel);
    }
    if (this.connecting) {
      console.debug(`MessageChannelWithFactory#connect: already connecting`);
      return this.connecting;
    }
    console.debug(`MessageChannelWithFactory#connect: using factory to connect`);
    return this.connecting = this.factory.connect()
        .then(channel => {
          console.debug(`MessageChannelWithFactory#connect: connected successfully`);
          this.channel = this.setupChannel(channel);
          this.connecting = undefined;
          return this.channel;
        });
  }

  private setupChannel(channel: ReplyingMessageChannel<R, L>): ReplyingMessageChannel<R, L> {
    channel.addEventListener('disconnect', () => this.handleDisconnect());
    channel.addEventListener('message', e => this.handleMessage(e));
    channel.addEventListener('messageerror', e => this.handleMessage(e));
    return channel;
  }

  private handleDisconnect() {
    console.debug(`MessageChannelWithFactory#handleDisconnect`);
    if (this.channel) {
      this.channel.close();
      this.channel = undefined;
    }
    if (this.options.auto) {
      console.debug(`MessageChannelWithFactory#handleDisconnect: auto-reconnecting`);
      this.reconnect()
          .catch(() => this.dispatchUnrecovered('disconnect'));
    } else {
      this.dispatchUnrecovered('disconnect');
    }
  }

  private handleMessage(event: MessageEvent<R>) {
    // @ts-ignore
    let init: MessageEventInit = event;
    let clone: MessageEvent = new MessageEvent<R>(event.type, init);
    this.dispatchEvent(clone);
  }

  private dispatchUnrecovered(type: 'close' | 'disconnect') {
    console.debug(`MessageChannelWithFactory#dispatchUnrecovered: ${type}`);
    let e: Event = new Event(type, {bubbles: true, cancelable: false, composed: true});
    this.dispatchEvent(e);
  }
}
