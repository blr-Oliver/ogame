import {ReplyingMessageEvent} from './ReplyingMessageEvent';

export type Transferable = ArrayBuffer | MessagePort;

export interface ReplyingMessagePortEventMap {
  'message': ReplyingMessageEvent;
  'messageerror': MessageEvent;
  'close': Event;
  'disconnect': Event;
}

export interface ReplyingMessageChannel<R = any, L = any> {
  postMessage(message: L, ignoreReply: true, transfer?: Transferable[]): void;
  postMessage(message: L, ignoreReply?: false, transfer?: Transferable[]): Promise<ReplyingMessageEvent<R, L>>;
  postMessage(message: L, ignoreReply?: boolean, transfer?: Transferable[]): Promise<ReplyingMessageEvent<R, L>> | void;

  addEventListener<K extends keyof ReplyingMessagePortEventMap>(type: K, listener: (this: ReplyingMessageChannel<R, L>, ev: ReplyingMessagePortEventMap[K]) => any, options?: AddEventListenerOptions | boolean): void;
  removeEventListener<K extends keyof ReplyingMessagePortEventMap>(type: K, listener: (this: ReplyingMessageChannel<R, L>, ev: ReplyingMessagePortEventMap[K]) => any, options?: boolean | EventListenerOptions): void;

  close(): void;
}

export interface ChannelFactory<R, L> {
  connect(): Promise<ReplyingMessageChannel<R, L>>;
}
