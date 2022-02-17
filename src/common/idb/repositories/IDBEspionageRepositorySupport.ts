import {IDBRepositorySupport} from '../IDBRepositorySupport';
import {IDBEspionageRepository} from './IDBEspionageRepository';

/*
  espionage-report
    keyPath: [coordinates.galaxy, coordinates.system, coordinates.position, coordinates.type, timestamp]
    indexes:
      shards (unique): coordinates.galaxy, coordinates.system, coordinates.position, coordinates.type, infoLevel, timestamp
      inactive: parsedStatus.vacation, parsedStatus.admin, parsedStatus.inactive, coordinates.galaxy, coordinates.system, coordinates.position, coordinates.type
      external-id (unique): id
*/
export class IDBEspionageRepositorySupport implements IDBRepositorySupport<IDBEspionageRepository> {
  create(db: IDBDatabase): IDBEspionageRepository {
    return new IDBEspionageRepository(db);
  }
  init(tx: IDBTransaction, oldVersion: number, newVersion: number): void {
    let db: IDBDatabase = tx.db;

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
}
