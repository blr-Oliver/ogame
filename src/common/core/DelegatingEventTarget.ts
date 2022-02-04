export class DelegatingEventTarget extends EventTarget {
  constructor() {
    super();
  }
  handleEvent(e: Event) {
    // @ts-ignore
    let clone = new e.constructor(e.type, e);
    this.dispatchEvent(clone);
  }
}
