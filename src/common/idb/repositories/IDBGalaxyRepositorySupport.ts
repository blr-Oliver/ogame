import {GalaxyRepository} from '../../../uniplatform/core/types/repositories';
import {IDBRepository} from '../IDBRepository';
import {IDBRepositorySupport} from '../IDBRepositorySupport';
import {IDBGalaxyRepository} from './IDBGalaxyRepository';

export class IDBGalaxyRepositorySupport implements IDBRepositorySupport<IDBRepository & GalaxyRepository> {
  create(db: IDBDatabase): IDBRepository & GalaxyRepository {
    return new IDBGalaxyRepository(db);
  }

  init(tx: IDBTransaction, oldVersion: number, newVersion: number): void {
    let db: IDBDatabase = tx.db;
    if (oldVersion < 1) this.version1(tx, db);
    if (oldVersion < 2) this.version2(tx, db);
    if (oldVersion < 3) this.version3(tx, db);
    if (oldVersion < 4) this.version4(tx, db);
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
 */
  private version3(tx: IDBTransaction, db: IDBDatabase) {
    let slotExStore = tx.objectStore('galaxy-report-slot-ex');

    slotExStore.deleteIndex('player');
    slotExStore.createIndex('player', ['player.id'], {unique: false});
    slotExStore.deleteIndex('alliance');
    slotExStore.createIndex('alliance', ['alliance.id', 'player.id'], {unique: false});
  }

  /*
    rename
      galaxy-report-ex        => galaxy-report
      galaxy-report-slot-ex   => galaxy-report-slot
  */
  private version4(tx: IDBTransaction, db: IDBDatabase) {
    db.deleteObjectStore('galaxy-report');
    db.deleteObjectStore('galaxy-report-slot');

    let systemExStore = tx.objectStore('galaxy-report-ex');
    let slotExStore = tx.objectStore('galaxy-report-slot-ex');

    systemExStore.name = 'galaxy-report';
    slotExStore.name = 'galaxy-report-slot';
  }
}
