export interface PropertyChangeEvent<T extends object, K extends keyof T> {
  readonly target: T;
  readonly property: K;
  readonly oldValue: T[K];
  readonly originalNewValue: T[K];
  readonly newValue: T[K];
}

export interface BeforePropertyChangeEvent<T extends object, K extends keyof T> extends PropertyChangeEvent<T, K> {
  cancel(): void;
}

export interface PropertyChangeListener<T extends object, K extends keyof T | void = void> {
  (event: PropertyChangeEvent<T, K extends keyof T ? K : keyof T>): void;
}

export interface BeforePropertyChangeListener<T extends object, K extends keyof T | void = void> {
  (event: BeforePropertyChangeEvent<T, K extends keyof T ? K : keyof T>): (K extends keyof T ? T[K] : any) | undefined;
}

export interface PropertyEventTarget<T extends object> {
  onBefore<K extends keyof T | null>(property: K, callback: BeforePropertyChangeListener<T, K extends keyof T ? K : void>): boolean;
  onAfter<K extends keyof T | null>(property: K, callback: PropertyChangeListener<T, K extends keyof T ? K : void>): boolean;
  offBefore<K extends keyof T | null>(property: K, callback: BeforePropertyChangeListener<T, K extends keyof T ? K : void>): boolean;
  offAfter<K extends keyof T | null>(property: K, callback: PropertyChangeListener<T, K extends keyof T ? K : void>): boolean;
}

export type ListenableObject<T extends object> = T & PropertyEventTarget<T>;

export class PropertyEventTargetProxyHandler<T extends object> implements PropertyEventTarget<T>, ProxyHandler<T> {
  private readonly namedBefore = new Map<keyof T, BeforePropertyChangeListener<T, keyof T>[]>();
  private readonly namedAfter = new Map<keyof T, PropertyChangeListener<T, keyof T>[]>();
  private readonly wildcardBefore: BeforePropertyChangeListener<T>[] = [];
  private readonly wildcardAfter: PropertyChangeListener<T>[] = [];

  set(target: T, p: string | symbol, val: any): boolean {
    const property: keyof T = p as keyof T;
    type K = typeof property;
    const oldValue: T[K] = target[property];
    const originalNewValue: T[K] = val as T[K];
    let newValue = originalNewValue;
    let cancelled = false;

    const beforeEvent: BeforePropertyChangeEvent<T, K> = Object.defineProperties({
      cancel() {
        cancelled = true;
      }
    } as BeforePropertyChangeEvent<T, K>, {
      target: {writable: false, value: target},
      property: {writable: false, value: property},
      oldValue: {writable: false, value: oldValue},
      originalNewValue: {writable: false, value: originalNewValue},
      newValue: {
        get(): T[K] {
          return newValue;
        }
      }
    });

    const namedBefore: BeforePropertyChangeListener<T, K>[] = this.namedBefore.get(property) as unknown as BeforePropertyChangeListener<T, K>[];
    const before: BeforePropertyChangeListener<T, K>[] = (namedBefore ? [...namedBefore, ...this.wildcardBefore] : this.wildcardBefore.slice()) as BeforePropertyChangeListener<T, K>[];

    if (before.length) {
      for (let i = 0; !cancelled && i < before.length; ++i) {
        // @ts-ignore
        let transformed: T[K] | undefined = before[i](beforeEvent);
        if (typeof transformed !== 'undefined') newValue = transformed;
      }
    }
    if (!cancelled) {
      if (typeof newValue !== 'undefined' || typeof oldValue !== 'undefined' || property in target)
        target[property] = newValue;
      const namedAfter: PropertyChangeListener<T, K>[] = this.namedAfter.get(property) as unknown as PropertyChangeListener<T, K>[];
      const after: PropertyChangeListener<T, K>[] = (namedAfter ? [...namedAfter, ...this.wildcardAfter] : this.wildcardAfter.slice()) as PropertyChangeListener<T, K>[];

      if (after.length) {
        delete (beforeEvent as any).cancel;
        for (let i = 0; i < after.length; ++i) {
          // @ts-ignore
          after[i](beforeEvent);
        }
      }
    }
    return true;
  }

  onBefore<K extends keyof T | null>(property: K, callback: BeforePropertyChangeListener<T, K extends keyof T ? K : void>): boolean {
    return this.on(property, callback, this.wildcardBefore, this.namedBefore);
  }

  offBefore<K extends keyof T | null>(property: K, callback: BeforePropertyChangeListener<T, K extends keyof T ? K : void>): boolean {
    return this.off(property, callback, this.wildcardBefore, this.namedBefore);
  }

  onAfter<K extends keyof T | null>(property: K, callback: PropertyChangeListener<T, K extends keyof T ? K : void>): boolean {
    return this.on(property, callback, this.wildcardAfter, this.namedAfter);
  }

  offAfter<K extends keyof T | null>(property: K, callback: PropertyChangeListener<T, K extends keyof T ? K : void>): boolean {
    return this.off(property, callback, this.wildcardAfter, this.namedAfter);
  }

  private on<K extends keyof T | null>(property: K, item: any, list: any[], map: Map<keyof T, any[]>): boolean {
    if (property === null) {
      return this.addIfMissing(item, list);
    } else {
      let list = map.get(property!);
      if (list) return this.addIfMissing(item, list);
      else {
        map.set(property!, [item]);
        return true;
      }
    }
  }

  private off<K extends keyof T | null>(property: K, item: any, list: any[], map: Map<keyof T, any[]>): boolean {
    return this.removeIfPresent(item, property === null ? list : map.get(property!));
  }

  private addIfMissing(item: any, list: any[]): boolean {
    if (list.indexOf(item) !== -1) return false;
    list.push(item);
    return true;
  }

  private removeIfPresent(item: any, list?: any[]): boolean {
    if (!list) return false;
    const index = list.indexOf(item);
    if (index === -1) return false;
    list.splice(index, 1);
    return true;
  }
}

export function makeListenable<T extends object>(target: T): ListenableObject<T> {
  const handler = new PropertyEventTargetProxyHandler<T>();
  const proxy = new Proxy(target, handler);
  const onBefore: typeof handler.onBefore =
      (property, listener) => handler.onBefore(property, listener);
  const offBefore: typeof handler.offBefore =
      (property, listener) => handler.offBefore(property, listener);
  const onAfter: typeof handler.onAfter =
      (property, listener) => handler.onAfter(property, listener);
  const offAfter: typeof handler.onAfter =
      (property, listener) => handler.offAfter(property, listener);
  return Object.defineProperties(proxy, {
    onBefore: {
      enumerable: false,
      writable: true,
      value: onBefore
    },
    offBefore: {
      enumerable: false,
      writable: true,
      value: offBefore
    },
    onAfter: {
      enumerable: false,
      writable: true,
      value: onAfter
    },
    offAfter: {
      enumerable: false,
      writable: true,
      value: offAfter
    }
  }) as ListenableObject<T>;
}
