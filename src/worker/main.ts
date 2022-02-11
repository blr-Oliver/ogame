import {ServiceWorkerContext} from './ServiceWorkerContext';

export function serviceWorkerMain(self: ServiceWorkerGlobalScope, context: ServiceWorkerContext) {
  const {
    galaxyMonitor,
    autoObserve
  } = context;

  self.addEventListener('fetch', (e: Event) => galaxyMonitor.spyGalaxyRequest(e as FetchEvent));
  autoObserve.continue();
  // rankSystemsWithInactiveTargets(galaxyRepository);
}
