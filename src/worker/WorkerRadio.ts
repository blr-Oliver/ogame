export class WorkerRadio {
  constructor(private self: ServiceWorkerGlobalScope) {
    this.installListeners();
  }

  private installListeners() {
    this.self.addEventListener('message', e => this.onMessage(e));
  }

  private onMessage(event: ExtendableMessageEvent): void {
    if (event.source && (event.source instanceof Client)) {
      let client: Client = event.source;
    }
  }
}
