import {AsyncSupplier, Supplier} from '../core/types/functional';

export function cacheResult<T>(supplier: Supplier<T>): Supplier<T> {
  let value: T;
  let cached: boolean = false;
  return () => {
    if (cached) return value;
    else {
      let result: T = supplier();
      cached = true;
      return value = result;
    }
  };
}

export function cacheAsyncResult<T>(supplier: AsyncSupplier<T>): AsyncSupplier<T> {
  let value: T;
  let cached: boolean = false;
  return async () => {
    if (cached) return value;
    else {
      let result: T = await supplier();
      cached = true;
      return value = result;
    }
  };
}
