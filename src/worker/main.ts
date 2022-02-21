import {ServiceWorkerContext} from './ServiceWorkerContext';
import {rankSystemsWithInactiveTargets} from './utils';

export function serviceWorkerMain(self: ServiceWorkerGlobalScope, context: ServiceWorkerContext) {
  const {
    shim,
    galaxyRepository,
    galaxyMonitor,
    autoObserve
  } = context;

  self.addEventListener('fetch', (e: Event) => galaxyMonitor.spyGalaxyRequest(e as FetchEvent));
  autoObserve.continue();
  shim.relay = true;
  rankSystemsWithInactiveTargets(galaxyRepository)
      .then(stats => console.log(stats));
}
