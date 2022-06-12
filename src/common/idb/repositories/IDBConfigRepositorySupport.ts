import {IDBRepositorySupport} from '../IDBRepositorySupport';
import {IDBConfigRepository} from './IDBConfigRepository';

export class IDBConfigRepositorySupport implements IDBRepositorySupport<IDBConfigRepository> {
  create(db: IDBDatabase): IDBConfigRepository {
    return new IDBConfigRepository(db);
  }

  init(tx: IDBTransaction, oldVersion: number, newVersion: number): void {
    let db: IDBDatabase = tx.db;
    if (oldVersion < 6) this.version6(tx, db);
  }

  private version6(tx: IDBTransaction, db: IDBDatabase) {
    db.createObjectStore('config', {
      autoIncrement: false,
      keyPath: null
    });
  }
}
