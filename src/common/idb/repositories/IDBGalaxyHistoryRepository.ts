import {slotsEqual} from '../../common';
import {GalaxySlot, GalaxySystemInfo} from '../../report-types';
import {GalaxyHistoryRepository} from '../../repository-types';
import {Coordinates, SystemCoordinates} from '../../types';
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
  drainWithTransform,
  getAll,
  getOne
} = IDBUtils;

export class IDBGalaxyHistoryRepository extends IDBRepository implements GalaxyHistoryRepository {
  static readonly OBJ_SLOT_HISTORY = 'galaxy-report-slot-history';

  constructor(db: IDBDatabase) {
    super(db);
  }

  condenseHistory(galaxy: number, system: number, position: number): Promise<GalaxySlot[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyHistoryRepository.OBJ_SLOT_HISTORY], 'readwrite');
    return this.withTransaction(tx, tx => new Promise((resolve, reject) => {
      const slotHistoryStore = tx.objectStore(IDBGalaxyHistoryRepository.OBJ_SLOT_HISTORY);
      const query = IDBKeyRange.bound([galaxy, system, position, MIN_DATE], [galaxy, system, position, MAX_DATE]);
      const result: GalaxySlot[] = [];
      const leadIt = slotHistoryStore.openCursor(query, 'next');
      let leadCursor: IDBCursorWithValue | null, followCursor: IDBCursorWithValue | null = null;
      let rangeStart: GalaxySlot | undefined, rangeEnd: GalaxySlot | undefined;
      let first = true;

      leadIt.onsuccess = () => {
        leadCursor = leadIt.result;
        if (leadCursor) {
          const slot = leadCursor.value;
          if (!rangeStart) {
            rangeStart = slot;
            result.push(slot);
          } else {
            if (slotsEqual(slot, rangeStart)) {
              if (rangeEnd)
                followCursor!.delete();
              rangeEnd = slot;
            } else {
              if (rangeEnd) result.push(rangeEnd);
              result.push(rangeStart = slot);
              rangeEnd = undefined;
            }
          }
          if (first) {
            first = false;
            const followIt = slotHistoryStore.openCursor(query, 'next');
            followIt.onsuccess = () => {
              followCursor = followIt.result;
              leadCursor!.continue();
            }
            followIt.onerror = leadIt.onerror;
          } else
            followCursor!.continue();
        } else {
          if (rangeEnd) result.push(rangeEnd);
          resolve(result);
        }
      }

      leadIt.onerror = e => reject(e);
    }));
  }

  loadSlotHistory(galaxy: number, system: number, position: number): Promise<GalaxySlot[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyHistoryRepository.OBJ_SLOT_HISTORY], 'readonly');
    return this.withTransaction(tx, tx =>
        getAll(tx.objectStore(IDBGalaxyHistoryRepository.OBJ_SLOT_HISTORY),
            IDBKeyRange.bound([galaxy, system, position, MIN_DATE], [galaxy, system, position, MAX_DATE])
        ));
  }
  loadSlotHistoryC(coordinates: Coordinates): Promise<GalaxySlot[]> {
    return this.loadSlotHistory(coordinates.galaxy, coordinates.system, coordinates.position);
  }
  loadSlotState(galaxy: number, system: number, position: number, timestamp: Date): Promise<[GalaxySlot?, GalaxySlot?]> {
    return Promise.reject('not implemented'); // TODO
  }
  loadSlotStateC(coordinates: Coordinates, timestamp: Date): Promise<[GalaxySlot?, GalaxySlot?]> {
    return this.loadSlotState(coordinates.galaxy, coordinates.system, coordinates.position, timestamp);
  }
  loadSystemHistory(coordinates: SystemCoordinates): Promise<unknown> {
    return Promise.reject('not implemented'); // TODO
  }
  loadSystemState(coordinates: SystemCoordinates): Promise<[GalaxySystemInfo?, GalaxySystemInfo?]> {
    return Promise.reject('not implemented'); // TODO
  }
  store(report: GalaxySystemInfo): Promise<any> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyHistoryRepository.OBJ_SLOT_HISTORY], 'readwrite');
    return this.withTransaction(tx,
        tx => upsertAll(tx.objectStore(IDBGalaxyHistoryRepository.OBJ_SLOT_HISTORY), ...report.slots),
        true);
  }
}
