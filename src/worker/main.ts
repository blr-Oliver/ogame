import {ServiceWorkerContext} from './ServiceWorkerContext';

export function serviceWorkerMain(self: ServiceWorkerGlobalScope, context: ServiceWorkerContext) {
  const {
    eventShim,
    galaxyMonitor,
    autoObserve
  } = context;

  eventShim.addEventListener('fetch', (e: Event) => galaxyMonitor.spyGalaxyRequest(e as FetchEvent));

  autoObserve.settings.pause = false;
  autoObserve.settings.delay = 0;
  autoObserve.continueObserve();
}
