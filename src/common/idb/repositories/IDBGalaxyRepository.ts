import {deduplicate} from '../../common';
import {GalaxySlot, GalaxySlotInfo, GalaxySystemInfo, PlayerInactivity} from '../../report-types';
import {GalaxyRepository} from '../../repository-types';
import {coordinateComparator, Coordinates, CoordinateType} from '../../types';
import {IDBRepository} from '../IDBRepository';
import {IDBUtils, MAX_DATE, MIN_DATE} from '../IDBUtils';

const {
  headMatchKeyRange,
  getAllFromIndex,
  getFirst,
  getTopMatching,
  getTopMatchingFromIndex,
  upsertOne,
  upsertAll
} = IDBUtils;

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
export class IDBGalaxyRepository extends IDBRepository implements GalaxyRepository {
  static readonly SYSTEM_STORE = 'galaxy-report';
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

  /*
  (galaxyMin: number, galaxyMax: number, systemMin: number, systemMax: number, galaxyLast: number | null, systemLast: number | null, normalTimeout: number, emptyTimeout: number) => Promise<...>
  (galaxyMin: number, galaxyMax: number, systemMin: number, systemMax: number, galaxyLast: number | null, systemLast: number | null, normalTimeout: number, emptyTimeout: number) => Promise<...>
   */
  findNextStale(galaxyMin: number, galaxyMax: number, systemMin: number, systemMax: number, galaxyLast: number | null, systemLast: number | null, normalTimeout: number, emptyTimeout: number): Promise<Coordinates | undefined> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.SYSTEM_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      let systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.SYSTEM_STORE);
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
