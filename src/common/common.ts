export const map: <T, U, A extends ArrayLike<T> | T[]>(array: A, callback: (value: T, index: number, array: A) => U, thisArg?: any) => U[] =
    Function.prototype.call.bind(Array.prototype.map);

export function deduplicate<T>(list: T[], compareFn?: (a: T, b: T) => number): T[] {
  if (!compareFn) compareFn = (a, b) => a < b ? -1 : (a > b ? 1 : 0);
  return list.sort(compareFn).reduce((res, next) => {
    if (!res.length || compareFn(res[res.length - 1], next) < 0)
      res.push(next);
    return res;
  }, [] as T[]);
}
