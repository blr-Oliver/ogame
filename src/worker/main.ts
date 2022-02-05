import {ServiceWorkerContext} from './ServiceWorkerContext';

declare var navigator: WorkerNavigator & { locks: LockManager };
export function serviceWorkerMain(self: ServiceWorkerGlobalScope, context: ServiceWorkerContext) {
  const {
    eventShim,
    galaxyMonitor,
    autoObserve,
    clientManager,
    galaxyRepository
  } = context;

  eventShim.addEventListener('fetch', (e: Event) => galaxyMonitor.spyGalaxyRequest(e as FetchEvent));

  autoObserve.continue();
  eventShim.addEventListener('message', e => {
    const event: ExtendableMessageEvent = e as ExtendableMessageEvent;
    if (event.source instanceof Client)
      clientManager.connectIfNecessary(event.source);
  });
  const lockName = 'test-lock';
  navigator.locks
      .request(lockName, {mode: 'exclusive'}, () => new Promise(() => {
        console.log(`Lock '${lockName}' taken by service worker successfully`);
      }))
      .then(() => {
        console.log(`Lock '${lockName}' released by service worker`);
      });

  // rankSystemsWithInactiveTargets(galaxyRepository);
}
