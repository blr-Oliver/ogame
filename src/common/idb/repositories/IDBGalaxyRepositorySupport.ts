import {IDBRepositorySupport} from '../IDBRepositorySupport';
import {IDBGalaxyRepository} from './IDBGalaxyRepository';

export class IDBGalaxyRepositorySupport implements IDBRepositorySupport<IDBGalaxyRepository> {
  create(db: IDBDatabase): IDBGalaxyRepository {
    return new IDBGalaxyRepository(db);
  }
  /*
  galaxy-report
    keyPath: galaxy, system, timestamp

  galaxy-report-slot
    keyPath: galaxy, system, position, timestamp
    indexes:
      parent: galaxy, system, timestamp
      timestamp: timestamp, galaxy, system
      inactive: player.status.vacation, player.status.admin, player.status.inactive
  */
  init(tx: IDBTransaction, oldVersion: number, newVersion: number): void {
    let db: IDBDatabase = tx.db;

    let systemStore = db.createObjectStore(IDBGalaxyRepository.SYSTEM_STORE, {
      autoIncrement: false,
      keyPath: ['galaxy', 'system', 'timestamp']
    });

    let slotStore = db.createObjectStore(IDBGalaxyRepository.SLOT_STORE, {
      autoIncrement: false,
      keyPath: ['galaxy', 'system', 'position', 'timestamp']
    });
    let parentIndex = slotStore.createIndex(IDBGalaxyRepository.SLOT_PARENT_INDEX, ['galaxy', 'system', 'timestamp'], {unique: false});
    let timestampIndex = slotStore.createIndex(IDBGalaxyRepository.SLOT_TIMESTAMP_INDEX, ['timestamp', 'galaxy', 'system'], {unique: false});
    let inactiveIndex = slotStore.createIndex(IDBGalaxyRepository.SLOT_INACTIVE_INDEX, ['player.status.vacation', 'player.status.admin', 'player.status.inactive'], {unique: false});
  }
}
