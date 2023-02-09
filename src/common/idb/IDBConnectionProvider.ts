import {IDBRepositoryInitializer} from './IDBRepositorySupport';

export class IDBConnectionProvider {
  private db?: IDBDatabase;

  constructor(private indexedDB: IDBFactory,
              public readonly dbName: string,
              private initializers: IDBRepositoryInitializer[]) {
  }

  connect(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    let openRequest: IDBOpenDBRequest = this.indexedDB.open(this.dbName, 7);

    return new Promise<IDBDatabase>((resolve, reject) => {
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onblocked = e => {
        console.log(`Database is blocked while trying to upgrade`, e);
      };
      openRequest.onupgradeneeded = e => {
        const event: IDBVersionChangeEvent = e as IDBVersionChangeEvent;
        const tx: IDBTransaction = openRequest.transaction!;
        console.debug(`Trying to upgrade (${event.oldVersion} => ${event.newVersion})`);
        for (let initializer of this.initializers)
          initializer(tx, event.oldVersion!, event.newVersion!);
        // for some reason the upgrade transaction MUST NOT be committed manually
        // tx.commit();
      };
    }).then(db => {
          db.onversionchange = () => db.close();
          db.onclose = () => this.db = undefined;
          return this.db = db;
        }
    );
  }
}
