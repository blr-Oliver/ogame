import {ShardedEspionageReport, ShardHeader, StampedEspionageReport} from '../../report-types';
import {EspionageRepository} from '../../repository-types';
import {Coordinates, CoordinateType} from '../../types';
import {IDBRepository} from '../IDBRepository';
import {IDBUtils} from '../IDBUtils';

const {
  headMatchKeyRange,
  getFirstFromIndex,
  getAllFromIndex,
  upsertOne
} = IDBUtils;

/*
  espionage-report
    keyPath: [coordinates.galaxy, coordinates.system, coordinates.position, coordinates.type, timestamp]
    indexes:
      shards (unique): coordinates.galaxy, coordinates.system, coordinates.position, coordinates.type, infoLevel, timestamp
      external-id (unique): id
*/

export class IDBEspionageRepository extends IDBRepository implements EspionageRepository {
  static readonly REPORT_STORE = 'espionage-report';
  static readonly SHARDS_INDEX = 'shards';
  static readonly EXTERNAL_ID_INDEX = 'external-id';

  constructor(db: IDBDatabase) {
    super(db);
  }

  deleteOldReports(): Promise<void> {
    let tx: IDBTransaction = this.db.transaction([IDBEspionageRepository.REPORT_STORE], 'readwrite');
    return this.withTransaction(tx, tx => new Promise((resolve, reject) => {
      const reportStore = tx.objectStore(IDBEspionageRepository.REPORT_STORE);
      const shardsIndex = reportStore.index(IDBEspionageRepository.SHARDS_INDEX);
      const shardKeyCursorRequest = shardsIndex.openKeyCursor(null, 'prev');
      let lastInfoLevelKey: number[] = [Infinity, Infinity, Infinity, Infinity, Infinity];
      shardKeyCursorRequest.onsuccess = () => {
        const shardKeyCursor = shardKeyCursorRequest.result;
        if (shardKeyCursor) {
          let currentKey = shardKeyCursor.key as IDBValidKey[];
          let currentInfoLevelKey = currentKey.slice(0, 5) as number[];
          if (this.cmpShardKeys(lastInfoLevelKey, currentInfoLevelKey) !== 0)
            lastInfoLevelKey = currentInfoLevelKey;
          else
            reportStore.delete(shardKeyCursor.primaryKey);
          shardKeyCursor.continue();
        } else resolve();
      };
      shardKeyCursorRequest.onerror = e => reject(e);
    }));
  }

  private cmpShardKeys(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; ++i) {
      let cmp = a[i] - b[i];
      if (cmp) return cmp;
    }
    return a.length - b.length;
  }

  load(galaxy: number, system: number, position: number, type: CoordinateType = CoordinateType.Planet): Promise<ShardedEspionageReport | undefined> {
    let tx: IDBTransaction = this.db.transaction([IDBEspionageRepository.REPORT_STORE], 'readonly');
    return this.withTransaction(tx, tx => {
      let reportStore = tx.objectStore(IDBEspionageRepository.REPORT_STORE);
      let key: IDBValidKey[] = [galaxy, system, position, type];
      return Promise.all(
          [0, 1, 2, 3, 4].map(infoLevel =>
              // get newest possible reports for each infoLevel
              getFirstFromIndex<StampedEspionageReport>(reportStore, IDBEspionageRepository.SHARDS_INDEX, headMatchKeyRange([...key, infoLevel], 'Date'), 'prev')
          ))
          .then(shards => shards.filter(s => !!s) as StampedEspionageReport[])
          .then(shards => IDBEspionageRepository.combineShards(shards));
    });
  }
  loadC(coordinates: Coordinates): Promise<ShardedEspionageReport | undefined> {
    return this.load(coordinates.galaxy, coordinates.system, coordinates.position, coordinates.type);
  }
  store(report: StampedEspionageReport): Promise<IDBValidKey> {
    if (!report.coordinates.type) report.coordinates.type = CoordinateType.Planet;
    let tx: IDBTransaction = this.db.transaction([IDBEspionageRepository.REPORT_STORE], 'readwrite');
    return this.withTransaction(tx, tx => {
      let reportStore = tx.objectStore(IDBEspionageRepository.REPORT_STORE);
      return upsertOne(reportStore, report);
    });
  }
  private static combineShards(shards: StampedEspionageReport[]): ShardedEspionageReport | undefined {
    if (!shards.length) return;
    // older first
    shards.sort((a: StampedEspionageReport, b: StampedEspionageReport) => a.timestamp.getTime() - b.timestamp.getTime())
    let source: ShardHeader[] = [];
    let result: ShardedEspionageReport = {
      source,
      ...shards[0]
    };
    for (let shard of shards) {
      // override from older to newer as far as infoLevel allows
      let infoLevel = shard.infoLevel;
      if (!(infoLevel >= 0)) continue;
      result.infoLevel = Math.max(result.infoLevel, infoLevel);
      result.coordinates = shard.coordinates;
      result.planetName = shard.planetName;
      result.playerName = shard.playerName;
      result.playerStatus = shard.playerStatus;
      result.parsedStatus = shard.parsedStatus;
      result.resources = shard.resources;
      source.push({
        id: shard.id,
        timestamp: shard.timestamp,
        infoLevel: shard.infoLevel
      });
      if (infoLevel >= 1) result.fleet = shard.fleet;
      if (infoLevel >= 2) result.defense = shard.defense;
      if (infoLevel >= 3) result.buildings = shard.buildings;
      if (infoLevel >= 4) result.researches = shard.researches;
    }
    return result;
  }
}
