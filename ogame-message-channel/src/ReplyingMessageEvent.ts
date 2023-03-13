import {Transferable} from './ReplyingMessageChannel';

export type ReplyHandler<R, L> = (target: ReplyingMessageEvent<R, L>, message: L, ignoreReply?: boolean, transfer?: Transferable[]) => Promise<ReplyingMessageEvent> | void;

export interface Packet<T> {
  id: number;
  previousId?: number;
  data: T;
}

function createInitParams<R>(source: MessageEvent<Packet<R>>): MessageEventInit<R> {
// @ts-ignore
  return Object.assign({}, source, {data: source.data.data});
}

export class ReplyingMessageEvent<R = any, L = any> extends MessageEvent<R> {
  readonly id: number;
  readonly previousId?: number;
  readonly originalEvent: MessageEvent;

  constructor(source: MessageEvent<Packet<R>>, replyHandler: ReplyHandler<R, L>) {
    super(source.type, createInitParams(source));
    this.id = source.data.id;
    this.previousId = source.data.previousId;
    this.originalEvent = source;
    Object.defineProperty(this, 'reply', {
      value: (msg: L, noReply?: boolean, transfer?: Transferable[]) => replyHandler(this, msg, noReply, transfer),
      enumerable: true,
      writable: false
    });
  }

  get source(): MessagePort | null {
    return super.source as MessagePort;
  }

  reply(message: L, ignoreReply: true, transfer?: Transferable[]): void;
  reply(message: L, ignoreReply?: false, transfer?: Transferable[]): Promise<ReplyingMessageEvent>;
  reply(message: L, ignoreReply?: boolean, transfer?: Transferable[]): Promise<ReplyingMessageEvent> | void;
  reply(message: L, ignoreReply?: boolean, transfer?: Transferable[]): Promise<ReplyingMessageEvent> | void {
    throw new TypeError('Cannot invoke reply on orphan message');
  }
}
