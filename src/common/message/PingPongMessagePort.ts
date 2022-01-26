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

export interface PingPongMessageEvent extends MessageEvent {
  id: number;
  previousId?: number;
  pingPong: PingPongMessagePort;
  reply: (message: any, ignoreReply?: boolean, transfer?: Transferable[]) => Promise<PingPongMessageEvent> | void;
}

interface PingPongPacket {
  _pingId: number;
  _pongId?: number;
  data: any;
}

interface PingPongPromiseHandler {
  promise: Promise<PingPongMessageEvent>;
  resolve: (result: PingPongMessageEvent) => void;
  reject: (error: any) => void;
}

export class PingPongMessagePort {
  private lastUsedId: number = 0;
  private readonly queue: { [id: string]: PingPongPromiseHandler | undefined };

  constructor(public readonly port: MessagePort) {
    this.queue = {};
    this.onmessage = null;
    this.installListeners();
    port.start();
  }

  static handshake(channelId: string, target: MessageTarget, source: EventTarget = globalThis): Promise<PingPongMessagePort> {
    let postMessage = this.adaptMessageTarget(target);
    return new Promise((resolve, reject) => {
      // TODO reject on some condition?
      let accepted = false;
      let channel = new MessageChannel();
      let localPort: MessagePort = channel.port1;
      let remotePort: MessagePort = channel.port2;

      let listener: EventListener = ((event: MessageEvent) => {
        let data = event.data;
        if (data['PingPongMessagePort'] === channelId) {
          switch (data.type) {
            case 'handshake':
              if (!accepted)
                finish(data.port, true);
              break;
            case 'accept':
              if (!accepted)
                finish(localPort, false);
              break;
          }
        }
      }) as EventListener;

      source.addEventListener('message', listener);

      postMessage({
        'PingPongMessagePort': channelId,
        type: 'handshake',
        port: remotePort
      }, remotePort);

      function finish(port: MessagePort, sendAccept: boolean) {
        accepted = true;
        if (sendAccept) {
          postMessage({
            'PingPongMessagePort': channelId,
            type: 'accept'
          });
        }
        source.removeEventListener('message', listener);
        resolve(new PingPongMessagePort(port));
      }
    });
  }

  static acceptHandshake(channelId: string, port: MessagePort, target: MessageTarget): PingPongMessagePort {
    let postMessage = this.adaptMessageTarget(target);
    postMessage({
      'PingPongMessagePort': channelId,
      type: 'accept'
    });
    return new PingPongMessagePort(port);
  }

  private static adaptMessageTarget(target: MessageTarget): (message: any, port?: MessagePort) => void {
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

  onmessage: ((this: PingPongMessagePort, ev: PingPongMessageEvent) => any) | null;
  postMessage(message: any, ignoreReply: boolean = false, transfer?: Transferable[]): Promise<PingPongMessageEvent> | void {
    return this.doPost(message, undefined, ignoreReply, transfer);
  }

  private installListeners() {
    this.port.onmessage = (e: MessageEvent) => {
      if (e.data && '_pingId' in e.data)
        this.handlePacket(e, e.data);
    };
  }

  private handlePacket(e: MessageEvent, data: PingPongPacket) {
    let previousId: number = data._pongId || 0;
    this.lastUsedId = Math.max(data._pingId!, previousId, this.lastUsedId);
    let handler: PingPongPromiseHandler | undefined = undefined;
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

  private createEvent(e: MessageEvent, data: PingPongPacket): PingPongMessageEvent {
    let id: number = data._pingId!;
    let previousId: number | undefined = data._pongId;
    let transformed: MessageEvent = new MessageEvent('message');
    transformed.initMessageEvent('message', e.bubbles, e.cancelable, data.data, e.origin, e.lastEventId, e.source, e.ports as MessagePort[]);
    let result: PingPongMessageEvent = Object.assign(transformed, {
      id,
      previousId,
      pingPong: this,
      reply: (message: any, ignoreReply?: boolean, transfer?: Transferable[]) => this.reply(result, message, ignoreReply, transfer)
    });
    return result;
  }

  private reply(e: PingPongMessageEvent, message: any, ignoreReply: boolean = false, transfer?: Transferable[]): Promise<PingPongMessageEvent> | void {
    return this.doPost(message, e.id, ignoreReply, transfer);
  }

  private doPost(message: any, previousId?: number, ignoreReply: boolean = false, transfer?: Transferable[]): Promise<PingPongMessageEvent> | void {
    let packet = {
      _pingId: ++this.lastUsedId,
      _pongId: previousId,
      data: message
    };
    this.port.postMessage(packet, {
      transfer
    });
    if (!ignoreReply) {
      let resolve: (result: PingPongMessageEvent) => void,
          reject: (error: any) => void,
          promise = new Promise<PingPongMessageEvent>((res, rej) => {
            resolve = res;
            reject = rej;
          });
      this.queue[packet._pingId!] = {
        promise,
        resolve: resolve!,
        reject: reject!
      };
      return promise;
    }
  }
}
