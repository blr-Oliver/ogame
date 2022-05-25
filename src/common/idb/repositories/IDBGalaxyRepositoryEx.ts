import {compareCoordinatesKeys, deduplicate} from '../../common';
import {GalaxyClass, GalaxySlot, GalaxySystemInfo, PlayerInactivity} from '../../report-types';
import {Coordinates, CoordinateType, SystemCoordinates} from '../../types';
import {IDBRepository} from '../IDBRepository';
import {IDBUtils, MAX_DATE, MIN_DATE} from '../IDBUtils';
import getAll = IDBUtils.getAll;
import getOne = IDBUtils.getOne;


const {
  getKey,
  headMatchKeyRange,
  getAllFromIndex,
  getFirst,
  getTopMatchingFromIndex,
  getTopMatching,
  upsertOne,
  upsertAll,
  drainWithTransform
} = IDBUtils;

export class IDBGalaxyRepositoryEx extends IDBRepository {
  static readonly OBJ_SYSTEM = 'galaxy-report-ex';
  static readonly IDX_SYSTEM_CLASS = 'class';

  static readonly OBJ_SLOT = 'galaxy-report-slot-ex';
  static readonly IDX_SLOT_CLASS = 'class';
  static readonly IDX_SLOT_PLAYER = 'player';
  static readonly IDX_SLOT_ALLIANCE = 'alliance';
  static readonly IDX_SLOT_INACTIVE = 'inactive';

  static readonly OBJ_SYSTEM_HISTORY = 'galaxy-report-history';
  static readonly OBJ_SLOT_HISTORY = 'galaxy-report-slot-history';

  constructor(db: IDBDatabase) {
    super(db);
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
  loadSystem(galaxy: number, system: number): Promise<GalaxySystemInfo | undefined> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryEx.OBJ_SYSTEM], 'readonly');
    return this.withTransaction(tx, tx =>
        getOne(tx.objectStore(IDBGalaxyRepositoryEx.OBJ_SYSTEM), [galaxy, system]));
  }

  loadSlot(galaxy: number, system: number, position: number): Promise<GalaxySlot | undefined> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryEx.OBJ_SLOT], 'readonly');
    return this.withTransaction(tx, tx =>
        getOne(tx.objectStore(IDBGalaxyRepositoryEx.OBJ_SLOT), [galaxy, system, position]));
  }

  loadSlotC(coordinates: Coordinates): Promise<GalaxySlot | undefined> {
    return this.loadSlot(coordinates.galaxy, coordinates.system, coordinates.position);
  }

  store(report: GalaxySystemInfo): Promise<SystemCoordinates> {
    let tx: IDBTransaction = this.db.transaction([
      IDBGalaxyRepositoryEx.OBJ_SYSTEM, IDBGalaxyRepositoryEx.OBJ_SLOT,
      IDBGalaxyRepositoryEx.OBJ_SYSTEM_HISTORY, IDBGalaxyRepositoryEx.OBJ_SLOT_HISTORY
    ], 'readwrite');
    return this.withTransaction(tx, tx => {
      return Promise.all([
        upsertOne(tx.objectStore(IDBGalaxyRepositoryEx.OBJ_SYSTEM), report),
        upsertOne(tx.objectStore(IDBGalaxyRepositoryEx.OBJ_SYSTEM_HISTORY), report),
        upsertAll(tx.objectStore(IDBGalaxyRepositoryEx.OBJ_SLOT), report.slots),
        upsertAll(tx.objectStore(IDBGalaxyRepositoryEx.OBJ_SLOT_HISTORY), report.slots)
      ]);
    }, true)
        .then(([key]) => key as SystemCoordinates);
  }

  findStaleSystemsWithTargets(timeout: number): Promise<SystemCoordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryEx.OBJ_SLOT], 'readonly');
    const threshold = Date.now() - timeout * 1000;
    return this
        .withTransaction(tx, tx =>
            getTopMatchingFromIndex<GalaxySlot>(
                tx.objectStore(IDBGalaxyRepositoryEx.OBJ_SLOT),
                IDBGalaxyRepositoryEx.IDX_SLOT_INACTIVE,
                Infinity,
                slot => slot.timestamp!.getTime() > threshold,
                IDBKeyRange.lowerBound([GalaxyClass.Player, PlayerInactivity.Inactive])
            ))
        .then(slots => slots.map(slot => [slot.galaxy, slot.system] as SystemCoordinates))
        .then(res => deduplicate(res, compareCoordinatesKeys));
  }

  findAllStale(normalTimeout: number, emptyTimeout: number): Promise<SystemCoordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryEx.OBJ_SYSTEM], 'readonly');
    return this.withTransaction(tx, tx => {
      const systemStore = tx.objectStore(IDBGalaxyRepositoryEx.OBJ_SYSTEM);
      const classIdx = systemStore.index(IDBGalaxyRepositoryEx.IDX_SYSTEM_CLASS);
      const now = Date.now(),
          normalThreshold = new Date(now - normalTimeout * 1000),
          emptyThreshold = new Date(now - emptyTimeout * 1000);

      let sectionRequests: Promise<GalaxySystemInfo[]>[] = [];
      let klass = GalaxyClass.Unknown;
      sectionRequests.push(getAll(classIdx, IDBKeyRange.bound([klass, MIN_DATE], [klass, MAX_DATE])));
      for (++klass; klass <= GalaxyClass.NonPlayer; ++klass)
        sectionRequests.push(getAll(classIdx, IDBKeyRange.bound([klass, MIN_DATE], [klass, emptyThreshold])));
      for (; klass <= GalaxyClass.Player; ++klass)
        sectionRequests.push(getAll(classIdx, IDBKeyRange.bound([klass, MIN_DATE], [klass, normalThreshold])));
      return Promise.all(sectionRequests);
    })
        .then(sections => sections
            .flatMap(section => section
                .map(s => [s.galaxy, s.system] as SystemCoordinates)));
  }

  findInactiveTargets(): Promise<Coordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryEx.OBJ_SLOT], 'readonly');
    return this
        .withTransaction(tx, tx =>
            getAllFromIndex<GalaxySlot>(
                tx.objectStore(IDBGalaxyRepositoryEx.OBJ_SLOT),
                IDBGalaxyRepositoryEx.IDX_SLOT_INACTIVE,
                IDBKeyRange.lowerBound([GalaxyClass.Player, PlayerInactivity.Inactive])
            ))
        .then(slots => slots.flatMap(slot => {
          let coordinates: Coordinates = {
            galaxy: slot.galaxy,
            system: slot.system,
            position: slot.position
          };
          let result: Coordinates[] = [];
          if (slot.planet)
            result.push(coordinates); // Planet is default
          if (slot.moon)
            result.push({
              ...coordinates,
              type: CoordinateType.Moon
            });
          return result;
        }));
  }

}
