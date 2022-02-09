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
} else {
  console.error('Service workers not supported.')
}

const factory = new ServiceWorkerConnector(() => getCurrentClientId(navigator.locks));
const channel = new MessageChannelWithFactory(factory);
const autoObserve = new AutoObserveStub(channel);

(window as any)['autoObserve'] = autoObserve;

