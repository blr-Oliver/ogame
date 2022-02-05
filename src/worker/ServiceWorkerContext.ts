import {JSONGalaxyParser} from '../browser/parsers/galaxy-report-extractor';
import {Fetcher} from '../common/core/Fetcher';
import {GameContext} from '../common/core/GameContext';
import {LocationServerContext} from '../common/core/LocationServerContext';
import {NativeFetcher} from '../common/core/NativeFetcher';
import {RestrainedFetcher} from '../common/core/RestrainedFetcher';
import {ServerContext} from '../common/core/ServerContext';
import {IDBRepositoryProvider} from '../common/idb/IDBRepositoryProvider';
import {IDBRepositorySupport} from '../common/idb/IDBRepositorySupport';
import {IDBEspionageRepository} from '../common/idb/repositories/IDBEspionageRepository';
import {IDBEspionageRepositorySupport} from '../common/idb/repositories/IDBEspionageRepositorySupport';
import {IDBGalaxyRepository} from '../common/idb/repositories/IDBGalaxyRepository';
import {IDBGalaxyRepositorySupport} from '../common/idb/repositories/IDBGalaxyRepositorySupport';
import {GalaxyParser} from '../common/parsers';
import {EspionageRepository, GalaxyRepository} from '../common/repository-types';
import {AutoObserve} from '../common/services/AutoObserve';
import {GalaxyObserver} from '../common/services/GalaxyObserver';
import {StatefulAutoObserve} from '../common/services/StatefulAutoObserve';
import {ClientManager} from './ClientManager';
import {GalaxyRequestMonitor} from './GalaxyRequestMonitor';
import {NavigatorGameContext} from './NavigatorGameContext';

export class ServiceWorkerContext {
  private constructor(
      readonly eventShim: EventTarget,
      readonly fetcher: Fetcher,
      readonly serverContext: ServerContext,
      readonly gameContext: GameContext,
      readonly galaxyRepositorySupport: IDBRepositorySupport<IDBGalaxyRepository>,
      readonly espionageRepositorySupport: IDBRepositorySupport<IDBEspionageRepository>,
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
      eventShim: EventTarget
  ): Promise<ServiceWorkerContext> {
    const fetcher = new RestrainedFetcher(new NativeFetcher());
    const serverContext = new LocationServerContext(self.location);
    const gameContext = new NavigatorGameContext();
    const galaxyRepositorySupport = new IDBGalaxyRepositorySupport();
    const espionageRepositorySupport = new IDBEspionageRepositorySupport();
    const repositoryProvider = new IDBRepositoryProvider(self.indexedDB, 'ogame', {
      'galaxy': galaxyRepositorySupport,
      'espionage': espionageRepositorySupport
    });
    const [galaxyRepository, espionageRepository] = await Promise.all([
      repositoryProvider.getRepository<IDBGalaxyRepository>('galaxy'),
      repositoryProvider.getRepository<IDBEspionageRepository>('espionage')
    ]);
    const galaxyParser = new JSONGalaxyParser();
    const galaxyObserver = new GalaxyObserver(galaxyRepository, galaxyParser, fetcher, serverContext);
    const galaxyMonitor = new GalaxyRequestMonitor(galaxyRepository, galaxyParser);
    const autoObserve = new StatefulAutoObserve(galaxyObserver, galaxyRepository, gameContext, {
      timeout: 3600 * 4,
      emptyTimeout: 3600 * 24,
      delay: 100
    });
    const clientManager = new ClientManager(eventShim, autoObserve);

    return Promise.resolve(new ServiceWorkerContext(
        eventShim,
        fetcher,
        serverContext,
        gameContext,
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
    ));
  }
}
