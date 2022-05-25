import {IDBRepositorySupport} from '../IDBRepositorySupport';
import {IDBGalaxyRepository} from './IDBGalaxyRepository';
import {IDBGalaxyRepositoryEx} from './IDBGalaxyRepositoryEx';

export class IDBGalaxyRepositorySupport implements IDBRepositorySupport<IDBGalaxyRepository> {
  create(db: IDBDatabase): IDBGalaxyRepository {
    return new IDBGalaxyRepository(db);
  }

  init(tx: IDBTransaction, oldVersion: number, newVersion: number): void {
    let db: IDBDatabase = tx.db;
    if (oldVersion < 1) this.version1(tx, db);
    if (oldVersion < 2) this.version2(tx, db);
    if (oldVersion < 3) this.version3(tx, db);
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
  private version1(tx: IDBTransaction, db: IDBDatabase) {
    let systemStore = db.createObjectStore('galaxy-report', {
      autoIncrement: false,
      keyPath: ['galaxy', 'system', 'timestamp']
    });
    systemStore.createIndex('coordinates', ['galaxy', 'system'], {unique: false});

    let slotStore = db.createObjectStore('galaxy-report-slot', {
      autoIncrement: false,
      keyPath: ['galaxy', 'system', 'position', 'timestamp']
    });
    slotStore.createIndex('parent', ['galaxy', 'system', 'timestamp'], {unique: false});
    slotStore.createIndex('timestamp', ['timestamp', 'galaxy', 'system'], {unique: false});
    slotStore.createIndex('inactive', ['player.status.vacation', 'player.status.admin', 'player.status.inactive'], {unique: false});
  }

  /*
  galaxy-report-ex
    keyPath: galaxy, system
    indexes:
      class: class, timestamp

  galaxy-report-slot-ex
    keyPath: galaxy, system, position
    indexes:
      class: class
      player: player.name
      alliance: alliance.name, player.name
      inactive: class, player.status.inactive
 */
  private version2(tx: IDBTransaction, db: IDBDatabase) {
    let systemExStore = db.createObjectStore('galaxy-report-ex', {
      autoIncrement: false,
      keyPath: ['galaxy', 'system']
    });
    systemExStore.createIndex('class', ['class', 'timestamp'], {unique: false});

    let slotExStore = db.createObjectStore('galaxy-report-slot-ex', {
      autoIncrement: false,
      keyPath: ['galaxy', 'system', 'position']
    });
    slotExStore.createIndex('class', ['class'], {unique: false});
    slotExStore.createIndex('player', ['player.name'], {unique: false});
    slotExStore.createIndex('alliance', ['alliance.name', 'player.name'], {unique: false});
    slotExStore.createIndex('inactive', ['class', 'player.status.inactive'], {unique: false});
  }

  /*
  galaxy-report-ex
    keyPath: galaxy, system
    indexes:
      class: class, timestamp

  galaxy-report-slot-ex
    keyPath: galaxy, system, position
    indexes:
      class: class
      player: player.id
      alliance: alliance.id, player.id
      inactive: class, player.status.inactive

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
    let slotExStore = tx.objectStore('galaxy-report-slot-ex');

    slotExStore.deleteIndex('player');
    slotExStore.createIndex('player', ['player.id'], {unique: false});
    slotExStore.deleteIndex('alliance');
    slotExStore.createIndex('alliance', ['alliance.id', 'player.id'], {unique: false});

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
}
