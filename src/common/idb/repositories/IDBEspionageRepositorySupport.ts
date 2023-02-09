import {IDBRepositorySupport} from '../IDBRepositorySupport';
import {IDBEspionageRepository} from './IDBEspionageRepository';

/*
  espionage-report
    keyPath: [coordinates.galaxy, coordinates.system, coordinates.position, coordinates.type, timestamp]
    indexes:
      shards (unique): coordinates.galaxy, coordinates.system, coordinates.position, coordinates.type, infoLevel, timestamp
      external-id (unique): id
*/
export class IDBEspionageRepositorySupport implements IDBRepositorySupport<IDBEspionageRepository> {
  create(db: IDBDatabase): IDBEspionageRepository {
    return new IDBEspionageRepository(db);
  }
  init(tx: IDBTransaction, oldVersion: number, newVersion: number): void {
    let db: IDBDatabase = tx.db;
    if (oldVersion < 1) this.version1(tx, db);
    if (oldVersion < 7) this.version7(tx, db);
  }

  private version1(tx: IDBTransaction, db: IDBDatabase) {
    let reportStore = db.createObjectStore(IDBEspionageRepository.REPORT_STORE, {
      autoIncrement: false,
      keyPath: ['coordinates.galaxy', 'coordinates.system', 'coordinates.position', 'coordinates.type', 'timestamp']
    });

    let shardsIndex = reportStore.createIndex(IDBEspionageRepository.SHARDS_INDEX,
        ['coordinates.galaxy', 'coordinates.system', 'coordinates.position', 'coordinates.type', 'infoLevel', 'timestamp'],
        {unique: true});
    let externalIdIndex = reportStore.createIndex(IDBEspionageRepository.EXTERNAL_ID_INDEX,
        ['id'],
        {unique: true});
  }

  private version7(tx: IDBTransaction, db: IDBDatabase) {
    let reportStore = tx.objectStore(IDBEspionageRepository.REPORT_STORE);

    let apiKeyIndex = reportStore.createIndex(IDBEspionageRepository.API_KEY_INDEX,
        ['apiKey'],
        {unique: true});
  }
}
