export class Router {
  constructor(private self: ServiceWorkerGlobalScope) {
    this.self.addEventListener('fetch', e => this.dispatch(e));
  }

  private dispatch(event: FetchEvent) {
    event.respondWith(
        this.self.caches
            .match(event.request)
            .then(response => response ?? fetch(event.request))
    );
  }
}
