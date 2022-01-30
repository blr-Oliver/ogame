import {deduplicate} from '../../common';
import {GalaxySlot, GalaxySlotInfo, GalaxySystemInfo, PlayerInactivity} from '../../report-types';
import {GalaxyRepository} from '../../repository-types';
import {coordinateComparator, Coordinates, CoordinateType} from '../../types';
import {IDBRepository} from '../IDBRepository';
import {IDBUtils} from '../IDBUtils';

const {
  headMatchKeyRange,
  getAllFromIndex,
  getFirst,
  getTopMatchingFromIndex,
  upsertOne,
  upsertAll,
  drainWithTransform
} = IDBUtils;

type CoordinatesKey = [galaxy: number, system: number];

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
export class IDBGalaxyRepository extends IDBRepository implements GalaxyRepository {
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
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.SLOT_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      let slotStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SLOT_STORE);
      return getAllFromIndex<GalaxySlot>(slotStore, IDBGalaxyRepository.SLOT_INACTIVE_INDEX, IDBGalaxyRepository.INACTIVE_QUERY)
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

  findNextStale(fromGalaxy: number, toGalaxy: number, fromSystem: number, toSystem: number, normalTimeout: number, emptyTimeout: number, galaxyLast?: number, systemLast?: number): Promise<Coordinates | undefined> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.SYSTEM_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      const systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SYSTEM_STORE);
      const cIndex: IDBIndex = systemStore.index(IDBGalaxyRepository.SYSTEM_COORDINATES_INDEX);
      let upper: IDBValidKey = [toGalaxy, toSystem];
      let lower: IDBValidKey, query: IDBKeyRange;
      if (galaxyLast && systemLast) {
        if (galaxyLast === toGalaxy && systemLast === toSystem)
          return Promise.resolve(undefined);
        lower = [galaxyLast, systemLast];
        query = IDBKeyRange.bound(lower, upper, true);
      } else {
        lower = [fromGalaxy, fromSystem];
        query = IDBKeyRange.bound(lower, upper);
      }
      const now = Date.now();
      return drainWithTransform<GalaxySystemInfo, GalaxySystemInfo>(cIndex.openCursor(query, 'nextunique'),
          cReport => getFirst(systemStore, headMatchKeyRange([cReport.galaxy, cReport.system], 'Date'), 'prev'),
          1,
          report => {
            let age = (now - report.timestamp!.getTime()) / 1000;
            return age >= (report.empty ? emptyTimeout : normalTimeout);
          })
          .then(reports => reports[0])
          .then(report => report && {
            galaxy: report.galaxy,
            system: report.system,
            position: 0
          });
    });
  }

  findNextMissing(fromGalaxy: number, toGalaxy: number, fromSystem: number, toSystem: number, maxSystem: number, galaxyLast?: number, systemLast?: number): Promise<Coordinates | undefined> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.SYSTEM_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      const systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SYSTEM_STORE);
      const lastKey: CoordinatesKey = [toGalaxy, toSystem];
      let candidate: CoordinatesKey | undefined;
      if (galaxyLast && systemLast) {
        candidate = IDBGalaxyRepository.nextCoordinatesKey([galaxyLast, systemLast], lastKey, maxSystem);
        if (!candidate) return Promise.resolve(undefined);
      } else
        candidate = [fromGalaxy, fromSystem];
      return getTopMatchingFromIndex<GalaxySystemInfo>(systemStore, IDBGalaxyRepository.SYSTEM_COORDINATES_INDEX, 1,
          (report) => {
            let currentKey: CoordinatesKey = [report.galaxy, report.system];
            if (currentKey[0] === candidate![0] && currentKey[1] === candidate![1]) {
              candidate = IDBGalaxyRepository.nextCoordinatesKey(currentKey, lastKey, maxSystem);
              return false;
            }
            return true;
          }, IDBKeyRange.lowerBound(candidate), 'nextunique')
          .then(() => candidate && {
            galaxy: candidate[0],
            system: candidate[1],
            position: 0
          });
    });
  }

  private static nextCoordinatesKey(key: CoordinatesKey, to: CoordinatesKey, maxSystem: number): CoordinatesKey | undefined {
    let next: CoordinatesKey = [key[0], key[1] + 1];
    if (next[1] > maxSystem) {
      next[0]++;
      next[1] = 1;
    }
    if (next[0] < to[0] || next[0] === to[0] && next[1] <= to[1]) return next;
  }

  findStaleSystemsWithTargets(timeout: number): Promise<Coordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.SLOT_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      let slotStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SLOT_STORE);
      let query = IDBKeyRange.lowerBound([new Date(Date.now() - timeout), -Infinity, -Infinity], true);
      return getTopMatchingFromIndex<GalaxySlot>(slotStore, IDBGalaxyRepository.SLOT_TIMESTAMP_INDEX, Infinity, slot => {
        return !slot.player?.status?.admin;
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
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.SYSTEM_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      let systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SYSTEM_STORE);
      return getFirst(systemStore, headMatchKeyRange([galaxy, system], 'Date'), 'prev');
    });
  }
  loadC(coordinates: Coordinates): Promise<GalaxySystemInfo | undefined> {
    return this.load(coordinates.galaxy, coordinates.system);
  }
  store(report: GalaxySystemInfo): Promise<IDBValidKey> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.SYSTEM_STORE, IDBGalaxyRepository.SLOT_STORE], 'readwrite');
    return this.withTransaction(tx, tx => {
      let systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SYSTEM_STORE);
      let slotStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SLOT_STORE);
      let slots: GalaxySlotInfo[] = report.slots.filter(x => !!x) as GalaxySlotInfo[];
      return Promise.all([
        upsertOne(systemStore, report),
        upsertAll(slotStore, ...slots)
      ])
          .then(([key]) => key);
    }, true);
  }
}
