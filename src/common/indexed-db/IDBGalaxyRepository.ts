import {deduplicate} from '../common';
import {GalaxySlot, GalaxySlotInfo, GalaxySystemInfo, PlayerInactivity} from '../report-types';
import {GalaxyRepository} from '../repository-types';
import {Coordinates, CoordinateType} from '../types';
import {IDBUtils, MAX_DATE, MIN_DATE} from './IDBUtils';

const {
  headMatchQuery,
  getAllFromIndex,
  getFirst,
  getTopMatching,
  getTopMatchingFromIndex,
  upsertOne,
  upsertAll
} = IDBUtils;

function coordinateComparator(a: Coordinates, b: Coordinates): number {
  return a.galaxy - b.galaxy || a.system - b.system || a.position - b.position || (a.type ?? CoordinateType.Planet) - (b.type ?? CoordinateType.Planet)
}

/*
  galaxy-report
    keyPath: galaxy, system, timestamp

  galaxy-report-slot
    keyPath: galaxy, system, position, timestamp
    indexes:
      parent: galaxy, system, timestamp
      timestamp: timestamp, galaxy, system
      inactive: player.status.inactive, player.status.vacation, player.status.admin

*/
export class IDBGalaxyRepository implements GalaxyRepository {
  static readonly SYSTEM_STORE_NAME = 'galaxy-report';
  static readonly SLOT_STORE_NAME = 'galaxy-report-slot';
  private static readonly INACTIVE_QUERY: IDBKeyRange = IDBKeyRange.bound([PlayerInactivity.Inactive, 0, 0], [PlayerInactivity.InactiveLong, 0, 0]);

  constructor(private db: IDBDatabase) {
  }

  findInactiveTargets(): Promise<Coordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.SLOT_STORE_NAME], 'readonly');
    return this.withTransaction(tx, tx => {
      let slotStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SLOT_STORE_NAME);
      return getAllFromIndex<GalaxySlot>(slotStore, 'inactive', IDBGalaxyRepository.INACTIVE_QUERY)
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
  findNextStale(galaxyMin: number, galaxyMax: number, systemMin: number, systemMax: number, galaxyLast: number | null, systemLast: number | null, normalTimeout: number, emptyTimeout: number): Promise<Coordinates | undefined> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.SYSTEM_STORE_NAME], 'readonly');
    return this.withTransaction(tx, tx => {
      let systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SYSTEM_STORE_NAME);
      if (galaxyLast != null) {
        galaxyMin = galaxyLast;
        if (systemLast != null)
          systemMin = systemLast;
      }
      let lower: IDBValidKey = [galaxyMin, systemMin, MIN_DATE];
      let upper: IDBValidKey = [galaxyMax, systemMax, MAX_DATE];
      let query: IDBKeyRange = IDBKeyRange.bound(lower, upper);
      const now = Date.now();
      return getTopMatching<GalaxySystemInfo>(systemStore, 1, report => {
        let age = (now - report.timestamp!.getTime()) / 1000;
        return age >= (report.empty ? emptyTimeout : normalTimeout);
      }, query)
          .then(reports => reports[0])
          .then(report => report && {
            galaxy: report.galaxy,
            system: report.system,
            position: 0
          });
    });
  }
  findStaleSystemsWithTargets(timeout: number): Promise<Coordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.SLOT_STORE_NAME], 'readonly');
    return this.withTransaction(tx, tx => {
      let slotStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SLOT_STORE_NAME);
      let query = IDBKeyRange.lowerBound([new Date(Date.now() - timeout), -Infinity, -Infinity], true);
      return getTopMatchingFromIndex<GalaxySlot>(slotStore, 'timestamp', Infinity, slot => {
        return !slot.player.status.admin;
      }, query)
          .then(slots => slots.map(slot => ({
            galaxy: slot.galaxy,
            system: slot.system,
            position: 0
          } as Coordinates)))
          .then(coordinates => deduplicate(coordinates));
    });
  }
  load(galaxy: number, system: number): Promise<GalaxySystemInfo | undefined> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.SYSTEM_STORE_NAME], 'readonly');
    return this.withTransaction(tx, tx => {
      let systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SYSTEM_STORE_NAME);
      return getFirst(systemStore, headMatchQuery([galaxy, system], 'Date'), 'prev');
    });
  }
  loadC(coordinates: Coordinates): Promise<GalaxySystemInfo | undefined> {
    return this.load(coordinates.galaxy, coordinates.system);
  }
  store(report: GalaxySystemInfo): Promise<IDBValidKey> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.SYSTEM_STORE_NAME, IDBGalaxyRepository.SLOT_STORE_NAME], 'readwrite');
    return this.withTransaction(tx, tx => {
      let systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SYSTEM_STORE_NAME);
      let slotStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SLOT_STORE_NAME);
      let slots: GalaxySlotInfo[] = report.slots.filter(x => !!x);
      return Promise.all([
        upsertOne(systemStore, report),
        upsertAll(slotStore, ...slots)
      ])
          .then(([key]) => key);
    }, true);
  }

  private withTransaction<T>(tx: IDBTransaction, action: (tx: IDBTransaction) => Promise<T>, ensureCommitted: boolean = false): Promise<T> {
    let promise = action(tx);
    if (!ensureCommitted) {
      promise
          .then(() => tx.commit())
          .catch(() => tx.abort());
      return promise;
    } else {
      return promise
          .then(res => (tx.commit(), res))
          .catch(e => {
            tx.abort();
            throw e;
          });
    }
  }
}
