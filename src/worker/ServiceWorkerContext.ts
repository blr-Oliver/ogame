import {JSONGalaxyParser} from '../browser/parsers/json/galaxy-report-json';
import {getCurrentClientId} from '../common/client-id';
import {Fetcher} from '../common/core/Fetcher';
import {NativeFetcher} from '../common/core/NativeFetcher';
import {RestrainedFetcher} from '../common/core/RestrainedFetcher';
import {ServerContext} from '../common/core/ServerContext';
import {UniverseContext} from '../common/core/UniverseContext';
import {IDBRepositoryProvider} from '../common/idb/IDBRepositoryProvider';
import {IDBEspionageRepository} from '../common/idb/repositories/IDBEspionageRepository';
import {IDBEspionageRepositorySupport} from '../common/idb/repositories/IDBEspionageRepositorySupport';
import {IDBGalaxyRepository} from '../common/idb/repositories/IDBGalaxyRepository';
import {IDBGalaxyRepositorySupport} from '../common/idb/repositories/IDBGalaxyRepositorySupport';
import {GalaxyParser} from '../common/parsers';
import {EspionageRepository, GalaxyRepository} from '../common/repository-types';
import {AutoObserve} from '../common/services/AutoObserve';
import {LocationServerContext} from '../common/services/context/LocationServerContext';
import {NoDOMUniverseContext} from '../common/services/context/NoDOMUniverseContext';
import {GalaxyObserver} from '../common/services/GalaxyObserver';
import {StatefulAutoObserve} from '../common/services/StatefulAutoObserve';
import {ClientManager} from './ClientManager';
import {GalaxyRequestMonitor} from './GalaxyRequestMonitor';
import {ReplayingEventShim} from './ReplayingEventShim';

export class ServiceWorkerContext {
  private constructor(
      readonly selfId: string,
      readonly shim: ReplayingEventShim,
      readonly fetcher: Fetcher,
      readonly server: ServerContext,
      readonly universe: UniverseContext,
      readonly repositoryProvider: IDBRepositoryProvider,
      readonly galaxyRepository: GalaxyRepository,
      readonly espionageRepository: EspionageRepository,
      readonly galaxyParser: GalaxyParser,
      readonly galaxyObserver: GalaxyObserver,
      readonly galaxyMonitor: GalaxyRequestMonitor,
      readonly autoObserve: AutoObserve,
      readonly clientManager: ClientManager
  ) {
  }

  static async init(
      self: ServiceWorkerGlobalScope,
      shim: ReplayingEventShim,
      locks: LockManager
  ): Promise<ServiceWorkerContext> {
    const fetcher = new RestrainedFetcher(new NativeFetcher());
    const server = new LocationServerContext(self.location);
    const selfId = await getCurrentClientId(locks);
    const universe = await NoDOMUniverseContext.acquire(fetcher, server);
    const galaxyRepositorySupport = new IDBGalaxyRepositorySupport();
    const espionageRepositorySupport = new IDBEspionageRepositorySupport();
    const repositoryProvider = new IDBRepositoryProvider(self.indexedDB, 'ogame', {
      'galaxy': galaxyRepositorySupport,
      'espionage': espionageRepositorySupport
    });
    const [galaxyRepository, espionageRepository] = await Promise.all([
      repositoryProvider.getRepository<IDBGalaxyRepository>('galaxy'),
      repositoryProvider.getRepository<IDBEspionageRepository>('espionage')
    ])
    const galaxyParser = new JSONGalaxyParser();
    const galaxyObserver = new GalaxyObserver(galaxyRepository, galaxyParser, fetcher, server);
    const galaxyMonitor = new GalaxyRequestMonitor(galaxyRepository, galaxyParser);
    const autoObserve = new StatefulAutoObserve(galaxyObserver, galaxyRepository, universe, {
      timeout: 3600 * 4,
      emptyTimeout: 3600 * 24,
      delay: 100
    });
    const clientManager = new ClientManager(self, locks, selfId, autoObserve);

    return new ServiceWorkerContext(
        selfId,
        shim,
        fetcher,
        server,
        universe,
        repositoryProvider,
        galaxyRepository,
        espionageRepository,
        galaxyParser,
        galaxyObserver,
        galaxyMonitor,
        autoObserve,
        clientManager
    );
  }
}
