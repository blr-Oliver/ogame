import {getCurrentClientId} from '../common/client-id';
import {MessageChannelWithFactory} from '../common/message/MessageChannelWithFactory';
import {ServiceWorkerConnector} from './ServiceWorkerConnector';
import {initSkin} from './ui/skin';

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
  // console.debug(`Creating components`);
  const factory = new ServiceWorkerConnector(() => getCurrentClientId(navigator.locks));
  // console.debug(`Factory created`);
  const channel = new MessageChannelWithFactory(factory);
  // console.debug(`Channel created (might be not ready)`);
  /*
  const autoObserve = new AutoObserveStub(channel);
  // console.debug(`AutoObserve stub created (might be not ready)`);
  const serverContext = new LocationServerContext(window.location);

  const fetcher = new RestrainedFetcher(new NativeFetcher());

  const documentParser = new XmlLiteResponseParser();
  const movementParser = new XmlLiteFleetMovementParser();
  const loader = new FleetMovementLoader(serverContext, fetcher, documentParser, movementParser);
  (window as any)['autoObserve'] = autoObserve;
  (window as any)['movementLoader'] = loader;
  */
} else {
  console.error('Service workers not supported.')
}

initSkin();