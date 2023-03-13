import {DebrisGalaxyInfo, GalaxyClass, GalaxySlot, GalaxySlotCoordinates, GalaxySystemInfo, PlayerInactivity} from 'ogame-api-facade';
import {compareCoordinatesKeys, deduplicate} from 'ogame-common';
import {Coordinates, CoordinateType, SystemCoordinates} from 'ogame-core';
import {GalaxyRepository} from '../../../uniplatform/core/types/repositories';
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

export class IDBGalaxyRepository extends IDBRepository implements GalaxyRepository {
  static readonly OBJ_SYSTEM = 'galaxy-report';
  static readonly IDX_SYSTEM_CLASS = 'class';

  static readonly OBJ_SLOT = 'galaxy-report-slot';
  static readonly IDX_SLOT_CLASS = 'class';
  static readonly IDX_SLOT_PLAYER = 'player';
  static readonly IDX_SLOT_ALLIANCE = 'alliance';
  static readonly IDX_SLOT_INACTIVE = 'inactive';

  constructor(db: IDBDatabase) {
    super(db);
  }

  /*
    galaxy-report
      keyPath: galaxy, system
      indexes:
        class: class, timestamp

    galaxy-report-slot
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
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.OBJ_SYSTEM], 'readonly');
    return this.withTransaction(tx, tx =>
        getOne(tx.objectStore(IDBGalaxyRepository.OBJ_SYSTEM), [galaxy, system]));
  }

  loadSlot(galaxy: number, system: number, position: number): Promise<GalaxySlot | undefined> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.OBJ_SLOT], 'readonly');
    return this.withTransaction(tx, tx =>
        getOne(tx.objectStore(IDBGalaxyRepository.OBJ_SLOT), [galaxy, system, position]));
  }

  loadSlotC(coordinates: Coordinates): Promise<GalaxySlot | undefined> {
    return this.loadSlot(coordinates.galaxy, coordinates.system, coordinates.position);
  }

  store(report: GalaxySystemInfo): Promise<SystemCoordinates> {
    let tx: IDBTransaction = this.db.transaction([
      IDBGalaxyRepository.OBJ_SYSTEM, IDBGalaxyRepository.OBJ_SLOT
    ], 'readwrite');
    return this.withTransaction(tx, tx => {
      return Promise.all([
        upsertOne(tx.objectStore(IDBGalaxyRepository.OBJ_SYSTEM), report),
        upsertAll(tx.objectStore(IDBGalaxyRepository.OBJ_SLOT), ...report.slots)
      ]);
    }, true)
        .then(([key]) => key as SystemCoordinates);
  }

  findStaleSystemsWithTargets(timeout: number): Promise<SystemCoordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.OBJ_SLOT], 'readonly');
    const threshold = Date.now() - timeout * 1000;
    return this
        .withTransaction(tx, tx =>
            getTopMatchingFromIndex<GalaxySlot>(
                tx.objectStore(IDBGalaxyRepository.OBJ_SLOT),
                IDBGalaxyRepository.IDX_SLOT_INACTIVE,
                Infinity,
                slot => slot.timestamp!.getTime() > threshold,
                IDBKeyRange.lowerBound([GalaxyClass.Player, PlayerInactivity.Inactive])
            ))
        .then(slots => slots.map(slot => [slot.galaxy, slot.system] as SystemCoordinates))
        .then(res => deduplicate(res, compareCoordinatesKeys));
  }

  findAllStale(normalTimeout: number, emptyTimeout: number): Promise<SystemCoordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.OBJ_SYSTEM], 'readonly');
    return this.withTransaction(tx, tx => {
      const systemStore = tx.objectStore(IDBGalaxyRepository.OBJ_SYSTEM);
      const classIdx = systemStore.index(IDBGalaxyRepository.IDX_SYSTEM_CLASS);
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

  findAllMissing(maxGalaxy: number, maxSystem: number): Promise<SystemCoordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.OBJ_SYSTEM], 'readonly');
    return this.withTransaction(tx, tx => {
      const systemStore: IDBObjectStore = tx.objectStore(IDBGalaxyRepository.OBJ_SYSTEM);
      const key: SystemCoordinates = [1, 1];
      const advanceKey = this.getCoordinatesKeyIterator(maxSystem);
      const cursorRequest = systemStore.openCursor();
      return new Promise<SystemCoordinates[]>((resolve, reject) => {
        const data: SystemCoordinates[] = [];
        function skipTo(limit: SystemCoordinates) {
          while (compareCoordinatesKeys(key, limit) < 0) {
            data.push([key[0], key[1]]);
            advanceKey(key);
          }
        }
        cursorRequest.onsuccess = () => {
          const cursor: IDBCursorWithValue | null = cursorRequest.result;
          if (cursor) {
            const currentKey = cursor.key as SystemCoordinates;
            const value = cursor.value as GalaxySystemInfo;
            skipTo(currentKey);
            if (value.class === GalaxyClass.Unknown)
              data.push([currentKey[0], currentKey[1]]);
            advanceKey(key);
            cursor.continue(key);
          } else {
            skipTo([maxGalaxy, maxSystem + 1]);
            resolve(data);
          }
        };
        cursorRequest.onerror = e => reject(e);
      });
    });
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

  findInactiveTargets(): Promise<Coordinates[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.OBJ_SLOT], 'readonly');
    return this
        .withTransaction(tx, tx =>
            getAllFromIndex<GalaxySlot>(
                tx.objectStore(IDBGalaxyRepository.OBJ_SLOT),
                IDBGalaxyRepository.IDX_SLOT_INACTIVE,
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

  selectLatestReports(): Promise<GalaxySystemInfo[]> {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.OBJ_SYSTEM], 'readonly');
    return this.withTransaction(tx, tx =>
        getAllFromIndex(tx.objectStore(IDBGalaxyRepository.OBJ_SYSTEM),
            IDBGalaxyRepository.IDX_SYSTEM_CLASS,
            IDBKeyRange.lowerBound([GalaxyClass.Empty, MIN_DATE])
        ));
  }

  findAllCurrentDebris(): Promise<(GalaxySlotCoordinates & DebrisGalaxyInfo)[]> {
    return this.findDebris(IDBKeyRange.lowerBound([GalaxyClass.Debris], false), slot => !!slot.debris);
  }

  async findHangingDebris(): Promise<(GalaxySlotCoordinates & DebrisGalaxyInfo)[]> {
    const getNormal = this.findDebris(IDBKeyRange.bound([GalaxyClass.Debris], [GalaxyClass.Vacation]),
        slot => slot.position < 16 && !!slot.debris);
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.OBJ_SYSTEM], 'readonly');
    const getExpo = this.withTransaction(tx, tx =>
        getTopMatchingFromIndex<GalaxySystemInfo>(
            tx.objectStore(IDBGalaxyRepository.OBJ_SYSTEM),
            IDBGalaxyRepository.IDX_SYSTEM_CLASS,
            Infinity,
            system => !!system.slots[15]?.debris,
            IDBKeyRange.bound([GalaxyClass.Debris], [GalaxyClass.Vacation]),
            'next'));
    const [normalDebris, expoSystems] = await Promise.all([getNormal, getExpo]);
    return normalDebris.concat(
        expoSystems
            .map(system => system.slots[15]!)
            .map(s => ({
              galaxy: s.galaxy,
              system: s.system,
              position: s.position,
              timestamp: s.timestamp,
              metal: s.debris!.metal,
              crystal: s.debris!.crystal
            }))
    );
  }

  private findDebris(query: IDBKeyRange, test: (slot: GalaxySlot) => boolean) {
    let tx: IDBTransaction = this.db.transaction([IDBGalaxyRepository.OBJ_SLOT], 'readonly');
    return this.withTransaction(tx, tx =>
        getTopMatchingFromIndex<GalaxySlot>(tx.objectStore(IDBGalaxyRepository.OBJ_SLOT),
            IDBGalaxyRepository.IDX_SLOT_CLASS,
            Infinity, test, query, 'next'
        ))
        .then(slots => slots.map(s => ({
          galaxy: s.galaxy,
          system: s.system,
          position: s.position,
          timestamp: s.timestamp,
          metal: s.debris!.metal,
          crystal: s.debris!.crystal
        })));
  }

}
