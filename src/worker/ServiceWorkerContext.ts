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
import {IDBConfigRepositorySupport} from '../common/idb/repositories/IDBConfigRepositorySupport';
import {IDBEspionageRepositorySupport} from '../common/idb/repositories/IDBEspionageRepositorySupport';
import {IDBGalaxyHistoryRepositorySupport} from '../common/idb/repositories/IDBGalaxyHistoryRepositorySupport';
import {IDBGalaxyRepositorySupport} from '../common/idb/repositories/IDBGalaxyRepositorySupport';
import {GalaxyParser} from '../common/parsers';
import {ConfigRepository, EspionageRepository, GalaxyHistoryRepository, GalaxyRepository} from '../common/repository-types';
import {AjaxEventListLoader} from '../common/services/AjaxEventListLoader';
import {AutoObserve} from '../common/services/AutoObserve';
import {ConfigManager} from '../common/services/ConfigManager';
import {LocationServerContext} from '../common/services/context/LocationServerContext';
import {NoDOMPlayerContext} from '../common/services/context/NoDOMPlayerContext';
import {NoDOMUniverseContext} from '../common/services/context/NoDOMUniverseContext';
import {EspionageReportScrapper} from '../common/services/EspionageReportScrapper';
import {GalaxyObserver} from '../common/services/GalaxyObserver';
import {EventListLoader, Launcher} from '../common/services/Mapper';
import {DEFAULT_SETTINGS as RAIDER_DEFAULTS, Raider} from '../common/services/Raider';
import {DEFAULT_SETTINGS as ANALYZER_DEFAULTS, RaidReportAnalyzer} from '../common/services/RaidReportAnalyzer';
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
      readonly configRepository: ConfigRepository,
      readonly configManager: ConfigManager,
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
    const configSupport = new IDBConfigRepositorySupport();
    const repositoryProvider = new IDBRepositoryProvider(self.indexedDB, 'ogame', {
      'galaxy': galaxyRepositorySupport,
      'galaxy-history': galaxyHistoryRepositorySupport,
      'espionage': espionageRepositorySupport,
      'config': configSupport
    });
    const [
      galaxyRepository,
      galaxyHistoryRepository,
      espionageRepository,
      configRepository
    ] = await Promise.all([
      repositoryProvider.getRepository<IDBRepository & GalaxyRepository>('galaxy'),
      repositoryProvider.getRepository<IDBRepository & GalaxyHistoryRepository>('galaxy-history'),
      repositoryProvider.getRepository<IDBRepository & EspionageRepository>('espionage'),
      repositoryProvider.getRepository<IDBRepository & ConfigRepository>('config')
    ]);
    const configManager = new ConfigManager(configRepository);
    const galaxyParser = new JSONGalaxyParser();
    const eventListParser = new NoDOMEventListParser();
    const espionageParser = new NoDOMEspionageReportParser();
    const galaxyObserver = new GalaxyObserver(galaxyRepository, galaxyHistoryRepository, galaxyParser, fetcher, server);
    const galaxyMonitor = new GalaxyRequestMonitor(galaxyRepository, galaxyHistoryRepository, galaxyParser);
    const autoObserveSettings = await configManager.prepareConfig({
      timeout: 3600 * 2,
      emptyTimeout: 3600 * 36,
      delay: 20
    }, 'autoObserve');
    const autoObserve = new StatefulAutoObserve(galaxyObserver, galaxyRepository, universe, autoObserveSettings);
    const espionageScrapper = new EspionageReportScrapper(espionageRepository, espionageParser, fetcher, server);
    const launcher = new RecurringTokenLauncher(server, fetcher);
    const eventLoader = new AjaxEventListLoader(fetcher, eventListParser, server);
    const clientManager = new ClientManager(self, locks, selfId, autoObserve);
    const scanner = new Scanner(player, espionageRepository, launcher, eventLoader, espionageScrapper, flightCalc);
    const analyzerSettings = await configManager.prepareConfig(ANALYZER_DEFAULTS, 'analyzer');
    const analyzer = new RaidReportAnalyzer(universe, flightCalc, costCalc, analyzerSettings);
    const raiderSettings = await configManager.prepareConfig(RAIDER_DEFAULTS, 'raider');
    const raider = new Raider(player, galaxyRepository, espionageRepository, espionageScrapper, eventLoader, analyzer, launcher, raiderSettings);
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
        configRepository,
        configManager,
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
