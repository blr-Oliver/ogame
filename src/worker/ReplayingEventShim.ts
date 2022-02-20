interface RelayTask {
  event: Event;
  resolve?: () => void;
  reject?: (error: any) => void;
}

export class ReplayingEventShim extends EventTarget {
  #relay: boolean = true;
  private queue: RelayTask[] = [];

  constructor(relay: boolean = true) {
    super();
    this.#relay = relay;
  }

  get relay(): boolean {
    return this.#relay;
  }

  set relay(relay: boolean) {
    if (relay !== this.#relay) {
      if (relay)
        this.replayQueue();
      this.#relay = relay;
    }
  }

  static shim(source: EventTarget, initialRelay: boolean, ...preInstall: string[]): ReplayingEventShim {
    const shim = new ReplayingEventShim(initialRelay);
    const dispatcher: (e: Event) => void = e => shim.handleEvent(e);
    const handledEvents: { [type: string]: true } = {};
    const originalAdd = source.addEventListener;

    for (let type of preInstall)
      installDispatcher(type);

    source.addEventListener = function (type: string) {
      if (!handledEvents[type]) installDispatcher(type);
      // @ts-ignore
      shim.addEventListener(...arguments);
    }
    source.removeEventListener = function () {
      // @ts-ignore
      shim.removeEventListener(...arguments);
    }

    return shim;

    function installDispatcher(type: string) {
      handledEvents[type] = true;
      originalAdd.call(source, type, dispatcher);
    }
  }

  handleEvent(event: Event): void {
    const task = this.createTask(event);
    if (!this.#relay)
      this.queue.push(task);
    else
      this.processRelayingEvent(task);
  }

  private createTask(event: Event): RelayTask {
    // @ts-ignore
    const clone: Event = new event.constructor(event.type, event);
    if (event instanceof ExtendableEvent && clone instanceof ExtendableEvent) {
      let resolve: (x: void) => void;
      let reject: (error: any) => void;
      const waiter = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      event.waitUntil(waiter);
      clone.waitUntil = promise => event.waitUntil(promise);
      if (event instanceof FetchEvent && clone instanceof FetchEvent)
        clone.respondWith = response => event.respondWith(response);
      return {
        event: clone,
        resolve: resolve!,
        reject: reject!
      };
    } else
      return {event: clone};
  }

  private replayQueue(): void {
    while (this.queue.length)
      this.processRelayingEvent(this.queue.shift()!);
  }

  private processRelayingEvent(task: RelayTask) {
    try {
      this.dispatchEvent(task.event);
      if (task.resolve) task.resolve();
    } catch (e) {
      if (task.reject) task.reject(e);
    }
  }
}
