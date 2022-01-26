import {PingPongMessageEvent, PingPongMessagePort} from '../common/message/PingPongMessagePort';
import {Router} from './Router';

declare var self: ServiceWorkerGlobalScope;

let router = new Router(self);
self.addEventListener('message', (e: ExtendableMessageEvent) => {
  let data = e.data;
  if (typeof (data) === 'object' && 'PingPongMessagePort' in data) {
    if (data.type === 'handshake') {
      let exchange = PingPongMessagePort.acceptHandshake('exchange', data.port, e.source!);
      exchange.onmessage = (e: PingPongMessageEvent) => {
        let s = String(e.data);
        console.log(`In service worker from client: ${s}`);
        e.reply(s.split('').reverse().join(''), true);
      }
    }
  }
});
