import {getCurrentClientId} from '../common/client-id';
import {LocationServerContext} from '../common/core/LocationServerContext';
import {NativeFetcher} from '../common/core/NativeFetcher';
import {RestrainedFetcher} from '../common/core/RestrainedFetcher';
import {MessageChannelWithFactory} from '../common/message/MessageChannelWithFactory';
import {AutoObserveStub} from '../common/remote/AutoObserveStub';
import {NoDOMPlayerContext} from '../common/services/context/NoDOMPlayerContext';
import {NoDOMUniverseContext} from '../common/services/context/NoDOMUniverseContext';
import {TwoStepLauncher} from '../common/services/TwoStepLauncher';
import {CoordinateType, Mission, MissionType} from '../common/types';
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
  const fetcher = new RestrainedFetcher(new NativeFetcher());
  const serverContext = new LocationServerContext(window.location);
  const playerContext = new NoDOMPlayerContext(serverContext, fetcher);
  const launcher = new TwoStepLauncher(serverContext, fetcher);
  const mission: Mission = {
    from: 33811468,
    to: {
      galaxy: 7,
      system: 329,
      position: 9,
      type: CoordinateType.Moon
    },
    mission: MissionType.Espionage,
    fleet: {
      espionageProbe: 1
    }
  }
  function getUniverseConfig() {
    return NoDOMUniverseContext.acquire(fetcher, serverContext);
  }
  (window as any)['launcher'] = launcher;
  (window as any)['mission'] = mission;
  (window as any)['playerContext'] = playerContext;
  (window as any)['getUniverseConfig'] = getUniverseConfig;
} else {
  console.error('Service workers not supported.')
}
