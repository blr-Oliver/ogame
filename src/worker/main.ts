import {ServiceWorkerContext} from './ServiceWorkerContext';
import {rankSystemsWithInactiveTargets} from './utils';

export function serviceWorkerMain(self: ServiceWorkerGlobalScope, context: ServiceWorkerContext) {
  const {
    galaxyMonitor,
    autoObserve,
    galaxyRepository
  } = context;

  self.addEventListener('fetch', (e: Event) => galaxyMonitor.spyGalaxyRequest(e as FetchEvent));
  autoObserve.continue();
  galaxyRepository()
      .then(repo => rankSystemsWithInactiveTargets(repo))
      .then(stats => console.log(stats));
}
