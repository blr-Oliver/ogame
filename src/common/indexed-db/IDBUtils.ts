export type IDBQuery = IDBValidKey | IDBKeyRange;
export type IDBQueryable = IDBObjectStore | IDBIndex;
export type IDBKeyType = 'string' | 'number' | 'Date';

export const MIN_DATE = new Date(-8640000000000000);
export const MAX_DATE = new Date(8640000000000000);

export class IDBUtils {
  static headMatchQuery(key: IDBValidKey, ...tails: IDBKeyType[]): IDBKeyRange {
    if (!Array.isArray(key))
      key = [key];
    const size = key.length + tails.length;
    let lower: IDBValidKey[] = Array(size);
    let upper: IDBValidKey[] = Array(size);
    for (let i = 0; i < key.length; ++i)
      lower[i] = upper[i] = key[i];
    for (let i = key.length; i < size; ++i) {
      const type = tails[i - key.length];
      switch (type) {
        case 'string':
          lower[i] = '';
          upper[i] = '\uffff'; // for most cases that should be OK
          break;
        case 'number':
          lower[i] = -Infinity;
          upper[i] = Infinity;
          break;
        case 'Date':
          lower[i] = MIN_DATE;
          upper[i] = MAX_DATE;
          break;
      }
    }
    return IDBKeyRange.bound(lower, upper);
  }

  static getKey(value: any, keyPath: string | string[]): IDBValidKey {
    if (Array.isArray(keyPath))
      return keyPath.map(path => this.getProperty(value, ...path.split('.')));
    else
      return this.getProperty(value, ...keyPath.split('.'));
  }

  static setKey(value: any, keyPath: string | string[], key: IDBValidKey) {
    if (Array.isArray(keyPath))
      keyPath.forEach((path, i) => this.setProperty(value, key[i], ...path.split('.')));
    else
      this.setProperty(value, key, ...keyPath.split('.'));
  }

  static getProperty(obj: any, ...path: string[]): any {
    return path.reduce((context: any, property) => context && context[property], obj);
  }

  static getPropertyForced(obj: any, ...path: string[]): any {
    return path.reduce((context: any, property) => context[property] ?? (context[property] = {}), obj);
  }

  static setProperty(obj: any, value: any, ...path: string[]) {
    this.getPropertyForced(obj, ...path.slice(0, -1))[path[path.length - 1]] = value;
  }

  static getOne<T>(store: IDBQueryable, key: IDBValidKey): Promise<T | undefined> {
    return new Promise<T>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = e => reject(e);
    });
  }

  static getOneFromIndex<T>(store: IDBObjectStore, index: string, key: IDBValidKey): Promise<T | undefined> {
    return this.getOne(store.index(index), key);
  }

  static getAll<T>(store: IDBQueryable, query?: IDBQuery, direction?: IDBCursorDirection): Promise<T[]> {
    return this.drainCursor(store.openCursor(query, direction));
  }

  static getAllFromIndex<T>(store: IDBObjectStore, index: string, query: IDBQuery, direction?: IDBCursorDirection): Promise<T[]> {
    return this.getAll(store.index(index), query, direction);
  }

  static getTop<T>(store: IDBQueryable, n: number, query?: IDBKeyRange, direction?: IDBCursorDirection): Promise<T[]> {
    return this.drainCursor(store.openCursor(query, direction), n);
  }

  static getTopFromIndex<T>(store: IDBObjectStore, n: number, index: string, query?: IDBKeyRange, direction?: IDBCursorDirection): Promise<T[]> {
    return this.getTop(store.index(index), n, query, direction);
  }

  static getFirst<T>(store: IDBQueryable, query?: IDBKeyRange, direction?: IDBCursorDirection): Promise<T | undefined> {
    return this.getTop<T>(store, 1, query, direction).then(list => list[0]);
  }

  static getFirstFromIndex<T>(store: IDBObjectStore, index: string, query?: IDBKeyRange, direction?: IDBCursorDirection): Promise<T | undefined> {
    return this.getFirst(store.index(index), query, direction);
  }

  static getTopMatching<T>(store: IDBQueryable, n: number, test: (item: T) => boolean, query?: IDBKeyRange, direction?: IDBCursorDirection): Promise<T[]> {
    return this.drainCursor(store.openCursor(query, direction), n, test);
  }

  static getTopMatchingFromIndex<T>(store: IDBObjectStore, index: string, n: number, test: (item: T) => boolean, query?: IDBKeyRange, direction?: IDBCursorDirection): Promise<T[]> {
    return this.getTopMatching(store.index(index), n, test, query, direction);
  }

  static deleteAll(store: IDBObjectStore, query: IDBQuery): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = store.delete(query);
      request.onsuccess = () => resolve();
      request.onerror = e => reject(e);
    });
  }

  static deleteAllFromIndex(store: IDBObjectStore, index: string, query: IDBQuery): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = store.index(index).openCursor(query);
      const keyPath = store.keyPath;

      request.onsuccess = () => {
        const cursor: IDBCursorWithValue = request.result;
        if (cursor) {
          let key = this.getKey(cursor.value, keyPath);
          const deleteRequest = store.delete(key);
          deleteRequest.onsuccess = () => cursor.continue();
          deleteRequest.onerror = e => reject(e);
        } else
          resolve();
      };
      request.onerror = e => reject(e);
    });
  }

  static upsertOne<T>(store: IDBObjectStore, value: T, key?: IDBValidKey): Promise<IDBValidKey> {
    return new Promise((resolve, reject) => {
      const request = store.keyPath ? store.put(value) : store.put(value, key);
      request.onsuccess = () => {
        if (store.autoIncrement && !key)
          this.setKey(value, store.keyPath, request.result);
        resolve(request.result);
      }
      request.onerror = e => reject(e);
    });
  }

  static upsertAll<T>(store: IDBObjectStore, ...values: T[]): Promise<IDBValidKey[]> {
    return new Promise((resolve, reject) => {
      let i = 0, request: IDBRequest<IDBValidKey>;
      const keyPath = store.keyPath;
      const autoIncrement = store.autoIncrement;
      const ids: IDBValidKey[] = [];

      const next = () => {
        if (request) {
          ++i;
          if (autoIncrement)
            this.setKey(values[i], keyPath, request.result);
          ids.push(request.result);
        }
        if (i < values.length) {
          request = store.put(values[i]);
          request.onsuccess = next;
          request.onerror = e => reject(e);
        } else
          resolve(ids);
      }

      next();
    });
  }

  private static drainCursor<T>(cursorRequest: IDBRequest<IDBCursorWithValue>, limit: number = Infinity, test?: (item: T) => boolean): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      const data: T[] = [];
      let i = 0;

      cursorRequest.onsuccess = () => {
        const cursor: IDBCursorWithValue = cursorRequest.result;
        if (cursor && i < limit) {
          let item = cursor.value;
          if (!test || test(item)) {
            data.push(item);
            ++i;
          }
          cursor.continue();
        } else
          resolve(data);
      };
      cursorRequest.onerror = e => reject(e);
    });
  }
}
