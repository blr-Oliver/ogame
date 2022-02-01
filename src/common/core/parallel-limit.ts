export type Async<T> = (...args: any[]) => Promise<T>;

type WaitingCall<T, A extends Async<T>> = {
  readonly args: Parameters<A>;
  resolve: (result: T | PromiseLike<T>) => void;
  reject: (error: any) => void;
}

export function parallelLimit<T, A extends Async<T>>(action: A, limit: number): (...args: Parameters<A>) => Promise<T> {
  if (limit <= 0) throw new Error('limit must be > 0');
  let queue: WaitingCall<T, A>[] = [];
  let processing = 0;

  function proceed() {
    if (--processing < limit && queue.length) {
      const next = queue.shift()!;
      let promise;
      try {
        ++processing;
        promise = action(...next.args);
      } catch (error) {
        --processing;
        next.reject(error);
      }
      if (promise)
        promise.then(result => next.resolve(result), error => next.reject(error));
    }
  }

  return (...args: Parameters<A>) => {
    let promise: Promise<T>;
    if (processing < limit) {
      try {
        ++processing;
        promise = action(...args);
      } catch (error) {
        --processing;
        return Promise.reject(error);
      }
    } else {
      let
          res: (result: T | PromiseLike<T>) => void,
          rej: (error: any) => void;
      promise = new Promise<T>((resolve, reject) => {
        res = resolve;
        rej = reject;
      });
      queue.push({
        args,
        resolve: res!,
        reject: rej!
      });
    }
    return promise.then(result => {
      setTimeout(() => proceed(), 0);
      return result;
    }, error => {
      setTimeout(() => proceed(), 0);
      throw error;
    });

  };
}
