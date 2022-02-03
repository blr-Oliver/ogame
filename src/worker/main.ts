import {ServiceWorkerContext} from './ServiceWorkerContext';

export function serviceWorkerMain(self: ServiceWorkerGlobalScope, context: ServiceWorkerContext) {
  const {
    eventShim,
    galaxyMonitor,
    autoObserve,
    galaxyRepository
  } = context;

  eventShim.addEventListener('fetch', (e: Event) => galaxyMonitor.spyGalaxyRequest(e as FetchEvent));

  autoObserve.continue();

  /*
  galaxyRepository.findInactiveTargets()
      .then(targets => {
        const frequency = targets
            .map(c => ({
              c,
              key: systemCoordinatesKey([c.galaxy, c.system])
            }))
            .sort((a, b) => a.key.localeCompare(b.key))
            .reduce((counts, c) => {
              counts[c.key] = (counts[c.key] || 0) + 1;
              return counts;
            }, {} as { [key: string]: number });
        console.log(frequency);
      });
   */
}
