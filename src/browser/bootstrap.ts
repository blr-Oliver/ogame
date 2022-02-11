import {getCurrentClientId} from '../common/client-id';
import {MessageChannelWithFactory} from '../common/message/MessageChannelWithFactory';
import {AutoObserveStub} from '../common/remote/AutoObserveStub';
import {ServiceWorkerConnector} from './ServiceWorkerConnector';

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
  const autoObserve = new AutoObserveStub(channel);
  console.debug(`AutoObserve stub created (might be not ready)`);
  (window as any)['autoObserve'] = autoObserve;
} else {
  console.error('Service workers not supported.')
}

