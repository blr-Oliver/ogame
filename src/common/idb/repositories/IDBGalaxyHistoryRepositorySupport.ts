import {GalaxyHistoryRepository} from '../../../uniplatform/core/types/repositories';
import {IDBRepository} from '../IDBRepository';
import {IDBRepositorySupport} from '../IDBRepositorySupport';
import {IDBGalaxyHistoryRepository} from './IDBGalaxyHistoryRepository';

export class IDBGalaxyHistoryRepositorySupport implements IDBRepositorySupport<IDBRepository & GalaxyHistoryRepository> {
  create(db: IDBDatabase): IDBRepository & GalaxyHistoryRepository {
    return new IDBGalaxyHistoryRepository(db);
  }

  init(tx: IDBTransaction, oldVersion: number, newVersion: number): void {
    let db: IDBDatabase = tx.db;
    if (oldVersion < 3) this.version3(tx, db);
    if (oldVersion < 5) this.version5(tx, db);
  }

  /*
  galaxy-report-history
    keyPath: galaxy, system, timestamp
    indexes:
      class: class, timestamp

  galaxy-report-slot-history
    keyPath: galaxy, system, position, timestamp
    indexes:
      system: galaxy, system, timestamp
      class: class, timestamp
      player: player.id, timestamp
      alliance: alliance.id, timestamp
 */
  private version3(tx: IDBTransaction, db: IDBDatabase) {
    let systemHistoryStore = db.createObjectStore('galaxy-report-history', {
      autoIncrement: false,
      keyPath: ['galaxy', 'system', 'timestamp']
    });
    systemHistoryStore.createIndex('class', ['class', 'timestamp'], {unique: false});

    let slotHistoryStore = db.createObjectStore('galaxy-report-slot-history', {
      autoIncrement: false,
      keyPath: ['galaxy', 'system', 'position', 'timestamp']
    });

    slotHistoryStore.createIndex('system', ['galaxy', 'system', 'timestamp'], {unique: false});
    slotHistoryStore.createIndex('class', ['class', 'timestamp'], {unique: false});
    slotHistoryStore.createIndex('player', ['player.id', 'timestamp'], {unique: false});
    slotHistoryStore.createIndex('alliance', ['alliance.id', 'timestamp'], {unique: false});
  }

  private version5(tx: IDBTransaction, db: IDBDatabase) {
    db.deleteObjectStore('galaxy-report-history');
  }
}
