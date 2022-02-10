import {ReplyingMessageChannel, ReplyingMessagePortEventMap, Transferable} from './ReplyingMessageChannel';
import {Packet, ReplyHandler, ReplyingMessageEvent} from './ReplyingMessageEvent';

declare var navigator: { locks: LockManager };

interface WaitingRequest<R, L> {
  promise: Promise<ReplyingMessageEvent<R, L>>;
  resolve: (result: ReplyingMessageEvent<R, L>) => void;
  reject: (reason: any) => void;
}

export class WaitingRequestMessageChannel<R = any, L = any> extends EventTarget implements ReplyingMessageChannel<R, L> {
  readonly #replier: ReplyHandler<R, L> = (target, message, ignoreReply, transfer) => this.doPost(message, target.id, ignoreReply, transfer);
  private readonly port: MessagePort;
  private readonly remoteLockAbort: AbortController;
  private readonly localLockHolder: (x: any) => void;
  private readonly queue: { [id: string]: WaitingRequest<R, L> };
  private lastUsedId: number = 0;

  private constructor(port: MessagePort, localLockHolder: (x: any) => void, pendingRemoteLock: Promise<any>, remoteLockWaiter: AbortController) {
    super();
    this.port = port;
    this.localLockHolder = localLockHolder;
    this.remoteLockAbort = remoteLockWaiter;
    this.queue = {};

    pendingRemoteLock.then(
        () => this.shutdown('disconnect'),
        () => void 0);// this must be abort from signal

    this.port.addEventListener('message', event => this.handleRawMessage(event));
    this.port.addEventListener('messageerror', event => this.handleError(event));
  }

  postMessage(message: L, ignoreReply: true, transfer?: Transferable[]): void;
  postMessage(message: L, ignoreReply?: false, transfer?: Transferable[]): Promise<ReplyingMessageEvent<R, L>>;
  postMessage(message: L, ignoreReply?: boolean, transfer?: Transferable[]): Promise<ReplyingMessageEvent<R, L>> | void;
  postMessage(message: L, ignoreReply?: boolean, transfer?: Transferable[]): Promise<ReplyingMessageEvent<R, L>> | void {
    return this.doPost(message, undefined, ignoreReply, transfer);
  }
  addEventListener<K extends keyof ReplyingMessagePortEventMap>(type: K, listener: (this: WaitingRequestMessageChannel, ev: ReplyingMessagePortEventMap[K]) => any, options?: AddEventListenerOptions | boolean): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean): void {
    super.addEventListener(type, listener, options);
  }
  removeEventListener<K extends keyof ReplyingMessagePortEventMap>(type: K, listener: (this: WaitingRequestMessageChannel, ev: ReplyingMessagePortEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
    super.removeEventListener(type, listener, options);
  }
  close() {
    this.shutdown('close');
  }
  private handleError(event: MessageEvent) {
    // @ts-ignore
    let clone = new MessageEvent(event.type, event);
    this.dispatchEvent(clone);
  }
  private handleRawMessage(event: MessageEvent<Packet<R>>) {
    const previousId: number = event.data.previousId || 0;
    const id = event.data.id;
    const replyingEvent = new ReplyingMessageEvent<R, L>(event, this.#replier);
    this.lastUsedId = Math.max(id, previousId, this.lastUsedId);

    if (previousId && previousId in this.queue) {
      let request: WaitingRequest<R, L> = this.queue[previousId];
      delete this.queue[previousId];
      request.resolve.call(request.promise, replyingEvent);
    } else
      this.dispatchEvent(replyingEvent);
  }
  private doPost(message: L, previousId?: number | undefined, ignoreReply?: boolean, transfer?: Transferable[]): Promise<ReplyingMessageEvent<R, L>> | void {
    const id = ++this.lastUsedId;
    let packet: Packet<L> = {
      id,
      previousId,
      data: message
    };
    this.port.postMessage(packet, {transfer});
    if (!ignoreReply) {
      let resolve: (result: ReplyingMessageEvent<R, L>) => void,
          reject: (error: any) => void,
          promise = new Promise<ReplyingMessageEvent<R, L>>((res, rej) => {
            resolve = res;
            reject = rej;
          });
      this.queue[packet.id] = {
        promise,
        resolve: resolve!,
        reject: reject!
      };
      return promise;
    }
  }
  private releaseLocks() {
    this.remoteLockAbort.abort();
    this.localLockHolder(void 0);
  }
  private shutdown(reason: 'close' | 'disconnect') {
    this.port.close();
    this.releaseLocks();
    let event: Event = new Event(reason, {bubbles: true, cancelable: false, composed: true});
    this.dispatchEvent(event);
    for (let id in this.queue) {
      this.queue[id].reject(reason);
      delete this.queue[id];
    }
  }

  static connect<R, L>(port: MessagePort, uniqueId: string, timeout?: number): Promise<WaitingRequestMessageChannel<R, L>> {
    return new Promise((resolve, reject) => {
      let captured: (x: any) => void;
      let waiter = new Promise(res => captured = res);
      let remoteLockWaiter = new AbortController();
      let timeoutId: any;
      if (timeout && timeout > 0)
        timeoutId = setTimeout(() => {
          remoteLockWaiter.abort();
          captured(void 0);
          reject('timeout');
        }, timeout);

      navigator.locks.request(uniqueId, {
        mode: 'exclusive',
        steal: true,
        ifAvailable: false
      }, () => {
        port.addEventListener('message', handleHandshake, {once: true});
        port.start();
        port.postMessage({
          type: 'handshake',
          id: uniqueId
        });
        return waiter;
      });

      function handleHandshake(e: MessageEvent) {
        const data = e.data;
        if (data.type !== 'handshake' || !data.id) reject(new Error('handshake expected'));
        else {
          const remoteId: string = data.id;
          let pendingRemoteLock = navigator.locks.request(remoteId, {
                mode: 'exclusive',
                ifAvailable: false,
                signal: remoteLockWaiter.signal
              },
              () => Promise.resolve());
          if (timeoutId) clearTimeout(timeoutId);
          resolve(new WaitingRequestMessageChannel(port, captured, pendingRemoteLock, remoteLockWaiter));
        }
      }
    });
  }
}
