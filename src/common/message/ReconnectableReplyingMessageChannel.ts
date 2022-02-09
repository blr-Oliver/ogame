import {ReplyingMessageChannel, ReplyingMessagePortEventMap} from './ReplyingMessageChannel';

export interface ReconnectableReplyingMessageChannel<R, L> extends ReplyingMessageChannel<R, L> {
  addEventListener<K extends keyof ReplyingMessagePortEventMap>(type: K,
                                                                listener: (this: ReconnectableReplyingMessageChannel<R, L>, ev: ReplyingMessagePortEventMap[K]) => any,
                                                                options?: AddEventListenerOptions | boolean): void;
  removeEventListener<K extends keyof ReplyingMessagePortEventMap>(type: K,
                                                                   listener: (this: ReconnectableReplyingMessageChannel<R, L>, ev: ReplyingMessagePortEventMap[K]) => any,
                                                                   options?: boolean | EventListenerOptions): void;

  reconnect(): Promise<ReconnectableReplyingMessageChannel<R, L>>;
}
