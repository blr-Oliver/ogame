import {GalaxySlot, GalaxySystemInfo} from 'ogame-api-facade';
import {Coordinates, SystemCoordinates} from 'ogame-core';
import {GalaxyHistoryRepository} from 'ogame-repository-facade';
import {slotsEqual} from '../../../uniplatform/util/tied-coupling';
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
  loadSlotState(galaxy: number, system: number, position: number, timestamp: Date = new Date()): Promise<[GalaxySlot?, GalaxySlot?]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyHistoryRepository.OBJ_SLOT_HISTORY], 'readonly');
    return this.withTransaction(tx, tx => {
      const store = tx.objectStore(IDBGalaxyHistoryRepository.OBJ_SLOT_HISTORY);
      const past = getFirst<GalaxySlot>(store, IDBKeyRange.bound(
          [galaxy, system, position, MIN_DATE],
          [galaxy, system, position, timestamp],
          false, true), 'prev');

      const future = getFirst<GalaxySlot>(store, IDBKeyRange.bound(
          [galaxy, system, position, timestamp],
          [galaxy, system, position, MAX_DATE],
          false, false), 'next');

      return Promise.all([past, future]);
    });
  }
  loadSlotStateC(coordinates: Coordinates, timestamp: Date): Promise<[GalaxySlot?, GalaxySlot?]> {
    return this.loadSlotState(coordinates.galaxy, coordinates.system, coordinates.position, timestamp);
  }
  loadSystemHistory(coordinates: SystemCoordinates): Promise<GalaxySystemInfo[]> {
    return Promise.reject('not implemented'); // TODO
  }
  loadSystemState(coordinates: SystemCoordinates): Promise<[GalaxySystemInfo?, GalaxySystemInfo?]> {
    return Promise.reject('not implemented'); // TODO
  }
  store(report: GalaxySystemInfo, condense = true): Promise<any> {
    if (condense) return this.storeAndCondense(report);
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyHistoryRepository.OBJ_SLOT_HISTORY], 'readwrite');
    return this.withTransaction(tx,
        tx => upsertAll(tx.objectStore(IDBGalaxyHistoryRepository.OBJ_SLOT_HISTORY), ...report.slots),
        true);
  }
  storeAndCondense(report: GalaxySystemInfo): Promise<any> {
    type SlotKey = [number, number, number, Date];
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyHistoryRepository.OBJ_SLOT_HISTORY], 'readwrite');
    return this.withTransaction(tx, tx => new Promise((resolve, reject) => {
      const store = tx.objectStore(IDBGalaxyHistoryRepository.OBJ_SLOT_HISTORY);
      const headRequest = store.openCursor(
          IDBKeyRange.bound(
              [report.galaxy, report.system, 0, MIN_DATE],
              [report.galaxy, report.system + 1, 0, MIN_DATE],
              false, true),
          'prev');
      const followRequest = store.openCursor(
          IDBKeyRange.bound(
              [report.galaxy, report.system, 0, MIN_DATE],
              [report.galaxy, report.system + 1, 0, MIN_DATE],
              false, true),
          'prev');

      let headCursor: IDBCursorWithValue | null = null;
      let followCursor: IDBCursor | null = null;
      let lastPosition: [number, number, number] = [report.galaxy, report.system + 1, 0];
      let candidateKey: SlotKey | undefined;

      headRequest.onerror = (e) => reject(e);
      followRequest.onerror = (e) => reject(e);
      followRequest.onsuccess = () => {
        followCursor = followRequest.result;
        if (followCursor && candidateKey) {
          if (!isFollowCursorInPosition(candidateKey)) {
            followCursor.continue(candidateKey);
          } else {
            headCursor!.continue();
          }
        }
      }

      headRequest.onsuccess = () => {
        headCursor = headRequest.result;
        if (headCursor) {
          const key: SlotKey = headCursor.primaryKey as SlotKey;
          const lastValue = headCursor.value as GalaxySlot;
          const newValue = report.slots[key[2] - 1]!;
          const samePosition = lastPosition[0] === key[0] && lastPosition[1] === key[1] && lastPosition[2] === key[2];
          lastPosition = key.slice(0, 3) as [number, number, number];
          if (samePosition) {
            // checking previous record
            if (slotsEqual(lastValue, newValue)) {
              // assert !!candidateKey
              // assert isFollowCursorInPosition(candidateKey)
              followCursor!.delete();
            }
            headCursor.continue([key[0], key[1], key[2], MIN_DATE]);
          } else {
            // next position
            if (slotsEqual(lastValue, newValue)) {
              // current report slot and last saved do match, now should check penultimate saved value for this slot
              // but before that bring follow cursor to current position to be able to delete the record if needed
              candidateKey = key.slice() as SlotKey;
              if (followCursor) {
                if (isFollowCursorInPosition(candidateKey)) {
                  headCursor.continue();
                } else {
                  followCursor.continue(candidateKey);
                }
              } else {
                // followRequest is not ready yet - just return to let it catch up
              }
            } else {
              // first occurrence of the slot doesn't match - no need to condense, just skip to next
              headCursor.continue([key[0], key[1], key[2], MIN_DATE]);
            }
          }
        } else
          resolve(upsertAll(store, ...report.slots));
      }

      function isFollowCursorInPosition(key: SlotKey): boolean {
        const followKey: SlotKey = followCursor!.key as SlotKey;
        return followKey[0] === key[0] && followKey[1] === key[1] && followKey[2] === key[2] && followKey[3].getTime() === key[3].getTime();
      }
    }));
  }
}
