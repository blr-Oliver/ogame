export type Transferable = ArrayBuffer | MessagePort;

export interface WindowMessageTarget {
  postMessage(message: any, targetOrigin: string, transfer?: Transferable[]): void;
}

export interface ClientMessageTarget {
  postMessage(message: any, transfer?: Transferable[]): void;
}

export interface WorkerMessageTarget {
  postMessage(message: any, options?: { transfer?: Transferable[] }): void;
}

export type MessageTarget = WindowMessageTarget | ClientMessageTarget | WorkerMessageTarget;

export interface ReplyingMessageEvent extends MessageEvent {
  readonly id: number;
  readonly previousId?: number;
  readonly port: ReplyingMessagePort;
  reply: (message: any, ignoreReply?: boolean, transfer?: Transferable[]) => Promise<ReplyingMessageEvent> | void;
}

const TYPE_CONNECT = 'connect';
const TYPE_ACCEPT = 'accept';
const CHANNEL_ID = 'ReplyingMessagePort.channelId';

interface ConnectMessage {
  [CHANNEL_ID]: string;
  nonce: number;
  type: typeof TYPE_CONNECT;
  port: MessagePort;
}

interface AcceptMessage {
  [CHANNEL_ID]: string;
  nonce: number;
  type: typeof TYPE_ACCEPT;
}

type HandshakeMessage = ConnectMessage | AcceptMessage;
function isHandshakeMessage(data: any): data is HandshakeMessage {
  return data
      && typeof (data) === 'object'
      && typeof (data[CHANNEL_ID]) === 'string'
      && typeof (data.nonce) === 'number'
      && (data.type === TYPE_CONNECT || data.type === TYPE_ACCEPT);
}

interface Packet {
  id: number;
  previousId?: number;
  data: any;
}

interface ReplyHandler {
  promise: Promise<ReplyingMessageEvent>;
  resolve: (result: ReplyingMessageEvent) => void;
  reject: (error: any) => void;
}

function adaptMessageTarget(target: MessageTarget): (message: any, port?: MessagePort) => void {
  switch (target.constructor.name) {
    case 'Window':
      return (message, port) => {
        if (port)
          (target as WindowMessageTarget).postMessage(message, '*', [(port as unknown) as Transferable /* WTF */]);
        else
          (target as WindowMessageTarget).postMessage(message, '*');
      };
    case 'Client':
    case 'WindowClient':
      return (message, port) => {
        if (port)
          (target as ClientMessageTarget).postMessage(message, [(port as unknown) as Transferable /* WTF */]);
        else
          (target as ClientMessageTarget).postMessage(message);
      };
    default:
      return (message, port) => {
        if (port)
          (target as WorkerMessageTarget).postMessage(message, {transfer: [port]});
        else
          (target as WorkerMessageTarget).postMessage(message);
      };
  }
}

export class ReplyingMessagePort {
  private lastUsedId: number = 0;
  private readonly queue: { [id: string]: ReplyHandler | undefined };

  constructor(public readonly port: MessagePort) {
    this.queue = {};
    this.onmessage = null;
    this.installListeners();
    port.start();
  }

  static connect(channelId: string, target: MessageTarget, source: EventTarget = globalThis): Promise<ReplyingMessagePort> {
    const postMessage = adaptMessageTarget(target);
    return new Promise((resolve, reject) => {
      // TODO reject when stalled?
      let finished = false, nonce = -1, port: MessagePort;

      source.addEventListener('message', onHandshakeMessage as EventListener);
      tryConnect();

      function onHandshakeMessage(event: MessageEvent) {
        if (!finished) {
          if (isHandshakeMessage(event.data)) {
            let data: HandshakeMessage = event.data;
            if (data[CHANNEL_ID] === channelId) {
              switch (data.type) {
                case TYPE_CONNECT:
                  if (data.nonce === nonce)
                    tryConnect();
                  else if (data.nonce < nonce)
                    finish(data.port, data.nonce);
                  // else just wait until our request is accepted
                  break;
                case TYPE_ACCEPT:
                  if (data.nonce === nonce)
                    finish(port);
                  else reject('fatal error');
                  break;
              }
            }
          }
        }
      }

      function tryConnect() {
        if (!finished) {
          nonce = Math.random() * 0x100000000 >>> 0;
          let channel = new MessageChannel();
          port = channel.port1;
          let remotePort = channel.port2;
          postMessage({
            [CHANNEL_ID]: channelId,
            type: TYPE_CONNECT,
            nonce: nonce,
            port: remotePort
          } as ConnectMessage, remotePort);
        } else
          reject('handshake sequence broken');
      }

      function finish(port: MessagePort, nonce?: number) {
        if (!finished) {
          finished = true;
          if (nonce !== undefined) {
            postMessage({
              [CHANNEL_ID]: channelId,
              nonce,
              type: TYPE_ACCEPT
            } as AcceptMessage);
          }
          source.removeEventListener('message', onHandshakeMessage as EventListener);
          resolve(new ReplyingMessagePort(port));
        } else
          reject('handshake sequence broken');
      }
    });
  }

  onmessage: ((this: ReplyingMessagePort, ev: ReplyingMessageEvent) => any) | null;

  postMessage(message: any, ignoreReply: true, transfer?: Transferable[]): void;
  postMessage(message: any, ignoreReply?: false, transfer?: Transferable[]): Promise<ReplyingMessageEvent>;
  postMessage(message: any, ignoreReply: boolean, transfer?: Transferable[]): Promise<ReplyingMessageEvent> | void;
  postMessage(message: any, ignoreReply: boolean = false, transfer?: Transferable[]): Promise<ReplyingMessageEvent> | void {
    return this.doPost(message, undefined, ignoreReply, transfer);
  }

  private installListeners() {
    this.port.onmessage = (e: MessageEvent) => this.handlePacket(e, e.data);
  }

  private handlePacket(e: MessageEvent, data: Packet) {
    let previousId: number = data.previousId || 0;
    this.lastUsedId = Math.max(data.id!, previousId, this.lastUsedId);
    let handler: ReplyHandler | undefined = undefined;
    if (previousId && previousId in this.queue) {
      handler = this.queue[previousId];
      delete this.queue[previousId];
    }
    if (handler || this.onmessage) {
      let event = this.createEvent(e, data);
      if (handler) handler.resolve.call(handler.promise, event);
      else this.onmessage!(event);
    }
  }

  private createEvent(e: MessageEvent, data: Packet): ReplyingMessageEvent {
    let id: number = data.id!;
    let previousId: number | undefined = data.previousId;
    let transformed: MessageEvent = new MessageEvent('message');
    transformed.initMessageEvent('message', e.bubbles, e.cancelable, data.data, e.origin, e.lastEventId, e.source, e.ports as MessagePort[]);
    let result: ReplyingMessageEvent = Object.assign(transformed, {
      id,
      previousId,
      port: this,
      reply: (message: any, ignoreReply?: boolean, transfer?: Transferable[]) => this.doPost(message, result.id, ignoreReply, transfer)
    });
    return result;
  }

  private doPost(message: any, previousId?: number, ignoreReply: boolean = false, transfer?: Transferable[]): Promise<ReplyingMessageEvent> | void {
    let packet: Packet = {
      id: ++this.lastUsedId,
      previousId,
      data: message
    };
    this.port.postMessage(packet, {
      transfer
    });
    if (!ignoreReply) {
      let resolve: (result: ReplyingMessageEvent) => void,
          reject: (error: any) => void,
          promise = new Promise<ReplyingMessageEvent>((res, rej) => {
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
}
