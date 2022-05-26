import {compareCoordinatesKeys, deduplicate} from '../../common';
import {DebrisGalaxyInfo, GalaxySlot, GalaxySlotCoordinates, GalaxySystemInfo, PlayerInactivity} from '../../report-types';
import {GalaxyRepository} from '../../repository-types';
import {coordinateComparator, Coordinates, CoordinateType, SystemCoordinates} from '../../types';
import {IDBRepository} from '../IDBRepository';
import {IDBUtils, MAX_DATE, MIN_DATE} from '../IDBUtils';

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

// TODO use continue() with a key parameter

/*
  galaxy-report
    keyPath: galaxy, system, timestamp
    indexes:
      coordinates: galaxy, system

  galaxy-report-slot
    keyPath: galaxy, system, position, timestamp
    indexes:
      parent: galaxy, system, timestamp
      timestamp: timestamp, galaxy, system
      inactive: player.status.vacation, player.status.admin, player.status.inactive
*/
/**
 * @deprecated
 */
export class IDBGalaxyRepositoryOld extends IDBRepository {
  static readonly SYSTEM_STORE = 'galaxy-report';
  static readonly SYSTEM_COORDINATES_INDEX = 'coordinates';
  static readonly SLOT_STORE = 'galaxy-report-slot';
  static readonly SLOT_PARENT_INDEX = 'parent';
  static readonly SLOT_TIMESTAMP_INDEX = 'timestamp';
  static readonly SLOT_INACTIVE_INDEX = 'inactive';

  private static readonly INACTIVE_QUERY: IDBKeyRange = IDBKeyRange.bound([0, 0, PlayerInactivity.Inactive], [0, 0, PlayerInactivity.InactiveLong]);

  constructor(db: IDBDatabase) {
    super(db);
  }

  findInactiveTargets(): Promise<Coordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryOld.SLOT_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      let slotStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepositoryOld.SLOT_STORE);
      return getAllFromIndex<GalaxySlot>(slotStore, IDBGalaxyRepositoryOld.SLOT_INACTIVE_INDEX, IDBGalaxyRepositoryOld.INACTIVE_QUERY)
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
          }))
          .then(coordinates => deduplicate(coordinates, coordinateComparator));
    });
  }

  findNextStale(normalTimeout: number, emptyTimeout: number, [galaxy, system]: SystemCoordinates = [1, 1]): Promise<SystemCoordinates | undefined> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryOld.SYSTEM_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      const systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepositoryOld.SYSTEM_STORE);
      const cIndex: IDBIndex = systemStore.index(IDBGalaxyRepositoryOld.SYSTEM_COORDINATES_INDEX);
      const query = IDBKeyRange.lowerBound([galaxy, system], false);
      const staleTest = this.getStaleTest(Date.now(), normalTimeout, emptyTimeout);
      // TODO this is not very efficient - might improve by fetching only key on first seek (nextunique)
      return drainWithTransform<GalaxySystemInfo, GalaxySystemInfo>(cIndex.openCursor(query, 'nextunique'),
          cReport => getFirst(systemStore, headMatchKeyRange([cReport.galaxy, cReport.system], 'Date'), 'prev'),
          1, staleTest)
          .then(reports => reports[0])
          .then(report => report && [report.galaxy, report.system]);
    });
  }

  findAllStale(normalTimeout: number, emptyTimeout: number): Promise<SystemCoordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryOld.SYSTEM_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      const systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepositoryOld.SYSTEM_STORE);
      const cIndex: IDBIndex = systemStore.index(IDBGalaxyRepositoryOld.SYSTEM_COORDINATES_INDEX);
      const cursorRequest = cIndex.openCursor(headMatchKeyRange([], 'number', 'number'), 'prev');
      const test = this.getStaleTest(Date.now(), normalTimeout, emptyTimeout);
      return new Promise<GalaxySystemInfo[]>((resolve, reject) => {
        const data: GalaxySystemInfo[] = [];
        cursorRequest.onsuccess = () => {
          const cursor: IDBCursorWithValue | null = cursorRequest.result;
          if (cursor) {
            let item = cursor.value;
            let key = getKey(item, cIndex.keyPath) as SystemCoordinates;
            if (test(item)) data.push(item);
            --key[1];
            cursor.continue(key);
          } else
            resolve(data);
        };
        cursorRequest.onerror = e => reject(e);
      })
          .then(reports => reports.map(r => [r.galaxy, r.system]));
    });
  }

  findNextMissing(maxGalaxy: number, maxSystem: number, [galaxy, system]: SystemCoordinates = [1, 1]): Promise<SystemCoordinates | undefined> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryOld.SYSTEM_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      const systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepositoryOld.SYSTEM_STORE);
      const cIndex: IDBIndex = systemStore.index(IDBGalaxyRepositoryOld.SYSTEM_COORDINATES_INDEX);
      const key: SystemCoordinates = [galaxy, system];
      const advanceKey = this.getCoordinatesKeyIterator(maxSystem);
      const cursorRequest = cIndex.openKeyCursor(IDBKeyRange.lowerBound(key, false), 'nextunique');
      return new Promise<SystemCoordinates | undefined>((resolve, reject) => {
        cursorRequest.onsuccess = () => {
          const cursor: IDBCursor | null = cursorRequest.result;
          if (cursor && compareCoordinatesKeys(cursor.key as SystemCoordinates, key) === 0) {
            advanceKey(key);
            cursor.continue(key);
          } else {
            const isValidKey = compareCoordinatesKeys(key, [maxGalaxy, maxSystem]) <= 0;
            resolve(isValidKey ? key : undefined);
          }
        };
        cursorRequest.onerror = e => reject(e);
      })
    });
  }

  findAllMissing(maxGalaxy: number, maxSystem: number): Promise<SystemCoordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryOld.SYSTEM_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      const systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepositoryOld.SYSTEM_STORE);
      const cIndex: IDBIndex = systemStore.index(IDBGalaxyRepositoryOld.SYSTEM_COORDINATES_INDEX);
      const key: SystemCoordinates = [1, 1];
      const lastKey: SystemCoordinates = [maxGalaxy, maxSystem];
      const advanceKey = this.getCoordinatesKeyIterator(maxSystem);
      const cursorRequest = cIndex.openKeyCursor(IDBKeyRange.bound(key, lastKey), 'nextunique');
      return new Promise<SystemCoordinates[]>((resolve, reject) => {
        const data: SystemCoordinates[] = [];
        function skipTo(limit: SystemCoordinates) {
          while (compareCoordinatesKeys(key, limit) < 0) {
            data.push([key[0], key[1]]);
            advanceKey(key);
          }
        }
        cursorRequest.onsuccess = () => {
          const cursor: IDBCursor | null = cursorRequest.result;
          if (cursor) {
            skipTo(cursor.key as SystemCoordinates);
            advanceKey(key);
            cursor.continue(key);
          } else {
            advanceKey(lastKey);
            skipTo(lastKey);
            resolve(data);
          }
        };
        cursorRequest.onerror = e => reject(e);
      });
    });
  }

  private getStaleTest(now: number, normalTimeout: number, emptyTimeout: number): (item: GalaxySystemInfo) => boolean {
    return (report) => {
      let age = (now - report.timestamp!.getTime()) / 1000;
      return age >= (report.empty ? emptyTimeout : normalTimeout);
    };
  }

  private getCoordinatesKeyIterator(maxSystem: number): (key: SystemCoordinates) => void {
    return (key: SystemCoordinates) => {
      ++key[1];
      if (key[1] > maxSystem) {
        ++key[0];
        key[1] = 1;
      }
    };
  }

  findStaleSystemsWithTargets(timeout: number): Promise<SystemCoordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryOld.SLOT_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      let slotStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepositoryOld.SLOT_STORE);
      let query = IDBKeyRange.lowerBound([new Date(Date.now() - timeout), -Infinity, -Infinity], true);
      return getTopMatchingFromIndex<GalaxySlot>(slotStore, IDBGalaxyRepositoryOld.SLOT_TIMESTAMP_INDEX, Infinity, slot => {
        return !slot.player?.status.admin;
      }, query)
          .then(slots => slots.map(slot => [slot.galaxy, slot.system] as SystemCoordinates))
          .then(coordinates => deduplicate(coordinates, compareCoordinatesKeys));
    });
  }

  loadSystem(galaxy: number, system: number): Promise<GalaxySystemInfo | undefined> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryOld.SYSTEM_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      let systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepositoryOld.SYSTEM_STORE);
      return getFirst(systemStore, headMatchKeyRange([galaxy, system], 'Date'), 'prev');
    });
  }

  store(report: GalaxySystemInfo): Promise<IDBValidKey> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryOld.SYSTEM_STORE, IDBGalaxyRepositoryOld.SLOT_STORE], 'readwrite');
    return this.withTransaction(tx, tx => {
      let systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepositoryOld.SYSTEM_STORE);
      let slotStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepositoryOld.SLOT_STORE);
      let slots: GalaxySlot[] = report.slots.filter(x => !!x) as GalaxySlot[];
      return Promise.all([
        upsertOne(systemStore, report),
        upsertAll(slotStore, ...slots)
      ])
          .then(([key]) => key);
    }, true);
  }

  findAllCurrentDebris(): Promise<(GalaxySlotCoordinates & DebrisGalaxyInfo)[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryOld.SLOT_STORE], 'readonly');
    const test = (slot: GalaxySlot) => !!slot.debris && (slot.debris.metal > 0 || slot.debris.crystal > 0);
    return this.withTransaction(tx, tx => new Promise((resolve, reject) => {
          const result: (GalaxySlotCoordinates & DebrisGalaxyInfo)[] = [];
          const slotStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepositoryOld.SLOT_STORE);
          const cursorRequest = slotStore.openCursor(null, 'prev');
          cursorRequest.onerror = (x) => reject(x);
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (cursor) {
              let key: IDBValidKey[] = cursor.primaryKey as IDBValidKey[];
              let slot: GalaxySlot = cursor.value as GalaxySlot;
              if (test(slot)) {
                result.push({
                  galaxy: slot.galaxy,
                  system: slot.system,
                  position: slot.position,
                  timestamp: slot.timestamp,
                  metal: slot.debris!.metal,
                  crystal: slot.debris!.crystal
                });
              }
              cursor.continue([key[0], key[1], key[2], MIN_DATE]);
            } else {
              resolve(result);
            }
          }
        })
    );
  }

  selectLatestReports(): Promise<GalaxySystemInfo[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepositoryOld.SYSTEM_STORE], 'readonly');
    return this.withTransaction(tx, tx => new Promise((resolve, reject) => {
      const systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepositoryOld.SYSTEM_STORE);
      const cIndex: IDBIndex = systemStore.index(IDBGalaxyRepositoryOld.SYSTEM_COORDINATES_INDEX);
      const coordinatesRequest = cIndex.openKeyCursor(null, 'prevunique');
      const result: GalaxySystemInfo[] = [];

      let reportRequest: IDBRequest<IDBCursorWithValue | null>;
      let coordinatesCursor: IDBCursor | null = null;
      let reportCursor: IDBCursorWithValue | null = null;

      coordinatesRequest.onsuccess = () => {
        coordinatesCursor = coordinatesRequest.result;
        if (coordinatesCursor) {
          if (!reportRequest) {
            reportRequest = systemStore.openCursor(null, 'prev');
            reportRequest.onsuccess = () => {
              reportCursor = reportRequest.result;
              if (reportCursor) {
                result.push(reportCursor.value);
                if (coordinatesCursor) coordinatesCursor.continue();
              }
            }
            reportRequest.onerror = (x) => reject(x);
          }
          const coordinates = coordinatesCursor.key as SystemCoordinates;
          if (reportCursor)
            reportCursor.continue([coordinates[0], coordinates[1], MAX_DATE]);
        } else resolve(result);
      }
      coordinatesRequest.onerror = (x) => reject(x);
    }));
  }
}
