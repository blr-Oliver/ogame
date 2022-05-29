import {JSONGalaxyParser} from '../browser/parsers/json/galaxy-report-json';
import {NoDOMEspionageReportParser} from '../browser/parsers/no-dom/espionage-report-no-dom';
import {NoDOMEventListParser} from '../browser/parsers/no-dom/event-list-no-dom';
import {getCurrentClientId} from '../common/client-id';
import {CachingCostCalculator, CostCalculator} from '../common/core/calculator/CostCalculator';
import {FlightCalculator, StaticFlightCalculator} from '../common/core/calculator/FlightCalculator';
import {Fetcher} from '../common/core/Fetcher';
import {NativeFetcher} from '../common/core/NativeFetcher';
import {PlayerContext} from '../common/core/PlayerContext';
import {RestrainedFetcher} from '../common/core/RestrainedFetcher';
import {ServerContext} from '../common/core/ServerContext';
import {UniverseContext} from '../common/core/UniverseContext';
import {IDBRepository} from '../common/idb/IDBRepository';
import {IDBRepositoryProvider} from '../common/idb/IDBRepositoryProvider';
import {IDBEspionageRepository} from '../common/idb/repositories/IDBEspionageRepository';
import {IDBEspionageRepositorySupport} from '../common/idb/repositories/IDBEspionageRepositorySupport';
import {IDBGalaxyHistoryRepositorySupport} from '../common/idb/repositories/IDBGalaxyHistoryRepositorySupport';
import {IDBGalaxyRepositorySupport} from '../common/idb/repositories/IDBGalaxyRepositorySupport';
import {GalaxyParser} from '../common/parsers';
import {EspionageRepository, GalaxyHistoryRepository, GalaxyRepository} from '../common/repository-types';
import {AjaxEventListLoader} from '../common/services/AjaxEventListLoader';
import {AutoObserve} from '../common/services/AutoObserve';
import {LocationServerContext} from '../common/services/context/LocationServerContext';
import {NoDOMPlayerContext} from '../common/services/context/NoDOMPlayerContext';
import {NoDOMUniverseContext} from '../common/services/context/NoDOMUniverseContext';
import {EspionageReportScrapper} from '../common/services/EspionageReportScrapper';
import {GalaxyObserver} from '../common/services/GalaxyObserver';
import {EventListLoader, Launcher} from '../common/services/Mapper';
import {Raider} from '../common/services/Raider';
import {RaidReportAnalyzer} from '../common/services/RaidReportAnalyzer';
import {RecurringTokenLauncher} from '../common/services/RecurringTokenLauncher';
import {Scanner} from '../common/services/Scanner';
import {MissionScheduler} from '../common/services/Schedule';
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
      readonly player: PlayerContext,
      readonly flightCalc: FlightCalculator,
      readonly costCalc: CostCalculator,
      readonly repositoryProvider: IDBRepositoryProvider,
      readonly galaxyRepository: GalaxyRepository,
      readonly galaxyHistoryRepository: GalaxyHistoryRepository,
      readonly espionageRepository: EspionageRepository,
      readonly espionageScrapper: EspionageReportScrapper,
      readonly galaxyParser: GalaxyParser,
      readonly galaxyObserver: GalaxyObserver,
      readonly galaxyMonitor: GalaxyRequestMonitor,
      readonly autoObserve: AutoObserve,
      readonly launcher: Launcher,
      readonly eventLoader: EventListLoader,
      readonly clientManager: ClientManager,
      readonly scanner: Scanner,
      readonly analyzer: RaidReportAnalyzer,
      readonly raider: Raider,
      readonly scheduler: MissionScheduler
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
    const player = new NoDOMPlayerContext(server, fetcher);
    const flightCalc = new StaticFlightCalculator(universe);
    const costCalc = new CachingCostCalculator();
    const galaxyRepositorySupport = new IDBGalaxyRepositorySupport();
    const galaxyHistoryRepositorySupport = new IDBGalaxyHistoryRepositorySupport();
    const espionageRepositorySupport = new IDBEspionageRepositorySupport();
    const repositoryProvider = new IDBRepositoryProvider(self.indexedDB, 'ogame', {
      'galaxy': galaxyRepositorySupport,
      'galaxy-history': galaxyHistoryRepositorySupport,
      'espionage': espionageRepositorySupport
    });
    const [galaxyRepository, galaxyHistoryRepository, espionageRepository] = await Promise.all([
      repositoryProvider.getRepository<IDBRepository & GalaxyRepository>('galaxy'),
      repositoryProvider.getRepository<IDBRepository & GalaxyHistoryRepository>('galaxy-history'),
      repositoryProvider.getRepository<IDBEspionageRepository>('espionage')
    ]);
    const galaxyParser = new JSONGalaxyParser();
    const eventListParser = new NoDOMEventListParser();
    const espionageParser = new NoDOMEspionageReportParser();
    const galaxyObserver = new GalaxyObserver(galaxyRepository, galaxyHistoryRepository, galaxyParser, fetcher, server);
    const galaxyMonitor = new GalaxyRequestMonitor(galaxyRepository, galaxyHistoryRepository, galaxyParser);
    const autoObserve = new StatefulAutoObserve(galaxyObserver, galaxyRepository, universe, {
      timeout: 3600 * 2,
      emptyTimeout: 3600 * 36,
      delay: 20
    });
    const espionageScrapper = new EspionageReportScrapper(espionageRepository, espionageParser, fetcher, server);
    const launcher = new RecurringTokenLauncher(server, fetcher);
    const eventLoader = new AjaxEventListLoader(fetcher, eventListParser, server);
    const clientManager = new ClientManager(self, locks, selfId, autoObserve);
    const scanner = new Scanner(player, espionageRepository, launcher, eventLoader, espionageScrapper, flightCalc);
    const analyzer = new RaidReportAnalyzer(universe, flightCalc, costCalc);
    const raider = new Raider(player, galaxyRepository, espionageRepository, espionageScrapper, eventLoader, analyzer, launcher);
    const scheduler = new MissionScheduler(launcher);

    return new ServiceWorkerContext(
        selfId,
        shim,
        fetcher,
        server,
        universe,
        player,
        flightCalc,
        costCalc,
        repositoryProvider,
        galaxyRepository,
        galaxyHistoryRepository,
        espionageRepository,
        espionageScrapper,
        galaxyParser,
        galaxyObserver,
        galaxyMonitor,
        autoObserve,
        launcher,
        eventLoader,
        clientManager,
        scanner,
        analyzer,
        raider,
        scheduler
    );
  }
}
