import {JSONGalaxyParser} from '../browser/parsers/json/galaxy-report-json';
import {getCurrentClientId} from '../common/client-id';
import {cacheAsyncResult} from '../common/core/cached-async';
import {Fetcher} from '../common/core/Fetcher';
import {NativeFetcher} from '../common/core/NativeFetcher';
import {RestrainedFetcher} from '../common/core/RestrainedFetcher';
import {ServerContext} from '../common/core/ServerContext';
import {UniverseContext} from '../common/core/UniverseContext';
import {AsyncSupplier} from '../common/functional';
import {IDBRepositoryProvider} from '../common/idb/IDBRepositoryProvider';
import {IDBRepositorySupport} from '../common/idb/IDBRepositorySupport';
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

export class ServiceWorkerContext {
  private constructor(
      readonly idSupplier: AsyncSupplier<string>,
      readonly fetcher: Fetcher,
      readonly serverContext: ServerContext,
      readonly universeContext: AsyncSupplier<UniverseContext>,
      readonly galaxyRepositorySupport: IDBRepositorySupport<IDBGalaxyRepository>,
      readonly espionageRepositorySupport: IDBRepositorySupport<IDBEspionageRepository>,
      readonly repositoryProvider: IDBRepositoryProvider,
      readonly galaxyRepository: AsyncSupplier<GalaxyRepository>,
      readonly espionageRepository: AsyncSupplier<EspionageRepository>,
      readonly galaxyParser: GalaxyParser,
      readonly galaxyObserver: GalaxyObserver,
      readonly galaxyMonitor: GalaxyRequestMonitor,
      readonly autoObserve: AutoObserve,
      readonly clientManager: ClientManager
  ) {
  }

  static init(
      self: ServiceWorkerGlobalScope,
      locks: LockManager
  ): ServiceWorkerContext {
    const idSupplier = cacheAsyncResult(() => getCurrentClientId(locks));
    const fetcher = new RestrainedFetcher(new NativeFetcher());
    const serverContext = new LocationServerContext(self.location);
    const universeContext = cacheAsyncResult(() => NoDOMUniverseContext.acquire(fetcher, serverContext));
    const galaxyRepositorySupport = new IDBGalaxyRepositorySupport();
    const espionageRepositorySupport = new IDBEspionageRepositorySupport();
    const repositoryProvider = new IDBRepositoryProvider(self.indexedDB, 'ogame', {
      'galaxy': galaxyRepositorySupport,
      'espionage': espionageRepositorySupport
    });
    const galaxyRepository = cacheAsyncResult(() => repositoryProvider.getRepository<IDBGalaxyRepository>('galaxy'));
    const espionageRepository = cacheAsyncResult(() => repositoryProvider.getRepository<IDBEspionageRepository>('espionage'));
    const galaxyParser = new JSONGalaxyParser();
    const galaxyObserver = new GalaxyObserver(galaxyRepository, galaxyParser, fetcher, serverContext);
    const galaxyMonitor = new GalaxyRequestMonitor(galaxyRepository, galaxyParser);
    const autoObserve = new StatefulAutoObserve(galaxyObserver, galaxyRepository, universeContext, {
      timeout: 3600 * 4,
      emptyTimeout: 3600 * 24,
      delay: 100
    });
    const clientManager = new ClientManager(self, idSupplier, locks, autoObserve);

    return new ServiceWorkerContext(
        idSupplier,
        fetcher,
        serverContext,
        universeContext,
        galaxyRepositorySupport,
        espionageRepositorySupport,
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
