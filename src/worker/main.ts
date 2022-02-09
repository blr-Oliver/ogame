import {ServiceWorkerContext} from './ServiceWorkerContext';

declare var navigator: WorkerNavigator & { locks: LockManager };
export function serviceWorkerMain(self: ServiceWorkerGlobalScope, context: ServiceWorkerContext) {
  const {
    galaxyMonitor,
    autoObserve,
    clientManager,
    galaxyRepository
  } = context;

  self.addEventListener('fetch', (e: Event) => galaxyMonitor.spyGalaxyRequest(e as FetchEvent));
  self.addEventListener('message', event => {
    if (event.source instanceof Client)
      clientManager.connectIfNecessary(event.source);
  });

  autoObserve.continue();
  // rankSystemsWithInactiveTargets(galaxyRepository);
}
