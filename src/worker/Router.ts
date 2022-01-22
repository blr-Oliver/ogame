declare var self: ServiceWorkerGlobalScope;

export class Router {
  constructor() {
    self.addEventListener('fetch', e => this.dispatch(e));
  }

  private dispatch(event: FetchEvent) {
    event.respondWith(
        caches
            .match(event.request)
            .then(response => response ?? fetch(event.request))
    );
  }
}
