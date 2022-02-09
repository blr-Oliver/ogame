export class DelegatingEventTarget extends EventTarget {
  static DEFAULT_PROXY_METHODS: ReadonlyArray<string> = ['waitUntil', 'respondWith'];
  readonly #listener: (e: Event) => void = e => this.handleEvent(e);
  private readonly proxyMethods: ReadonlyArray<string>;

  constructor(proxyMethods?: string[]) {
    super();
    this.proxyMethods = proxyMethods ?? DelegatingEventTarget.DEFAULT_PROXY_METHODS;
  }
  handleEvent(e: Event) {
    // @ts-ignore
    let clone = new e.constructor(e.type, e);
    let proxies: { [method: string]: Function } = {};
    for (let methodName of this.proxyMethods)
      if (methodName in e && typeof (e as any)[methodName] === 'function')
        proxies[methodName] = function () {
          return (e as any)[methodName](...arguments);
        }
    this.dispatchEvent(Object.assign(clone, proxies));
  }
  shim(delegate: EventTarget, ...preInstall: string[]) {
    const handledEvents: { [type: string]: true } = {};
    const originalAdd = delegate.addEventListener;
    delegate.addEventListener = (type: string, listener: any) => {
      if (!handledEvents[type]) {
        handledEvents[type] = true;
        originalAdd.call(delegate, type, this.#listener);
      }
      this.addEventListener(type, listener);
    }
    delegate.removeEventListener = (type: string, listener: any) => {
      this.removeEventListener(type, listener);
    }
    for (let type of preInstall) {
      handledEvents[type] = true;
      originalAdd.call(delegate, type, this.#listener);
    }
  }
}
