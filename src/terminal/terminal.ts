import {ServiceWorkerConnector} from '../browser/ServiceWorkerConnector';
import {getCurrentClientId} from '../common/client-id';
import {MessageChannelWithFactory} from '../common/message/MessageChannelWithFactory';

if ('serviceWorker' in navigator) {
  const url = '/sw.js';
  navigator.serviceWorker
      .register(url, {
        type: 'classic'
      })
      .then(reg => {
        console.log(`Service worker from '${url}' registered. Scope is ${reg.scope}`);
      })
      .catch((error) => {
        console.error('Registration failed with ' + error);
      });
  console.debug(`Creating components`);
  const factory = new ServiceWorkerConnector(() => getCurrentClientId(navigator.locks));
  console.debug(`Factory created`);
  const channel = new MessageChannelWithFactory(factory);
  console.debug(`Channel created (might be not ready)`);
} else {
  console.error('Service workers not supported.')
}
console.log('script works!');