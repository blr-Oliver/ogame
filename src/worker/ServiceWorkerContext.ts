import {EventListLoader, Launcher, PlayerContext} from 'ogame-api-facade';
import {CachingCostCalculator, CostCalculator, FlightCalculator, StaticFlightCalculator} from 'ogame-calc';
import {ServerContext, UniverseContext} from 'ogame-core';
import {ConfigRepository, EspionageRepository, GalaxyHistoryRepository, GalaxyRepository} from 'ogame-repository-facade';
import {getCurrentClientId} from '../common/client-id';
import {Fetcher} from '../common/core/Fetcher';
import {NativeFetcher} from '../common/core/NativeFetcher';
import {RestrainedFetcher} from '../common/core/RestrainedFetcher';
import {SessionAwareFetcher} from '../common/core/SessionAwareFetcher';
import {IDBRepository} from '../common/idb/IDBRepository';
import {IDBRepositoryProvider} from '../common/idb/IDBRepositoryProvider';
import {IDBConfigRepositorySupport} from '../common/idb/repositories/IDBConfigRepositorySupport';
import {IDBEspionageRepositorySupport} from '../common/idb/repositories/IDBEspionageRepositorySupport';
import {IDBGalaxyHistoryRepositorySupport} from '../common/idb/repositories/IDBGalaxyHistoryRepositorySupport';
import {IDBGalaxyRepositorySupport} from '../common/idb/repositories/IDBGalaxyRepositorySupport';
import {JSONGalaxyParser} from '../common/parsers/json/galaxy-report-json';
import {NoDOMEspionageReportParser} from '../common/parsers/no-dom/espionage-report-no-dom';
import {NoDOMEventListParser} from '../common/parsers/no-dom/event-list-no-dom';
import {XmlLiteResponseParser} from '../common/parsers/xml-lite/XmlLiteResponseParser';
import {AutoObserve} from '../common/services/AutoObserve';
import {FleetPageUniverseContext} from '../common/services/context/FleetPageUniverseContext';
import {LocationServerContext} from '../common/services/context/LocationServerContext';
import {NoDOMPlayerContext} from '../common/services/context/NoDOMPlayerContext';
import {Expeditor, ExpeditorSettings} from '../common/services/Expeditor';
import {ConfigManager} from '../common/services/infra/ConfigManager';
import {LoginService} from '../common/services/infra/LoginService';
import {MissionScheduler} from '../common/services/infra/Schedule';
import {ThreatNotifier} from '../common/services/notification/ThreatNotifier';
import {AjaxEventListLoader} from '../common/services/operations/AjaxEventListLoader';
import {AjaxGalaxyObserver} from '../common/services/operations/AjaxGalaxyObserver';
import {EspionageReportScrapper} from '../common/services/operations/EspionageReportScrapper';
import {FleetPageInfoLoader} from '../common/services/operations/FleetPageInfoLoader';
import {RecurringTokenLauncher} from '../common/services/operations/RecurringTokenLauncher';
import {DEFAULT_SETTINGS as RAIDER_DEFAULTS, Raider} from '../common/services/Raider';
import {DEFAULT_SETTINGS as ANALYZER_DEFAULTS, RaidReportAnalyzer} from '../common/services/RaidReportAnalyzer';
import {StatefulAutoObserve} from '../common/services/StatefulAutoObserve';
import {GalaxyParser} from '../uniplatform/parsers';
import {ClientManager} from './ClientManager';
import * as defaultExpeditorSettings from './expeditor-settings.json';
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
      readonly galaxyObserver: AjaxGalaxyObserver,
      readonly galaxyMonitor: GalaxyRequestMonitor,
      readonly autoObserve: AutoObserve,
      readonly launcher: Launcher,
      readonly eventLoader: EventListLoader,
      readonly clientManager: ClientManager,
      readonly threatNotifier: ThreatNotifier,
      readonly analyzer: RaidReportAnalyzer,
      readonly raider: Raider,
      readonly scheduler: MissionScheduler,
      readonly loginService: LoginService,
      readonly expeditor: Expeditor,
      readonly fleetPageLoader: FleetPageInfoLoader
  ) {
  }

  static async init(
      self: ServiceWorkerGlobalScope,
      shim: ReplayingEventShim,
      locks: LockManager
  ): Promise<ServiceWorkerContext> {
    const rootFetcher = new NativeFetcher();
    const server = new LocationServerContext(self.location);
    const loginService = new LoginService(self, server, rootFetcher);
    const fetcher = new RestrainedFetcher(new SessionAwareFetcher(rootFetcher, loginService));
    const documentParser = new XmlLiteResponseParser();
    //const fetcher = new RestrainedFetcher(rootFetcher);
    const selfId = await getCurrentClientId(locks);
    const fleetPageLoader = new FleetPageInfoLoader(server, fetcher, documentParser);
    const universe = await FleetPageUniverseContext.acquire(fleetPageLoader);
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
    const galaxyObserver = new AjaxGalaxyObserver(galaxyRepository, galaxyHistoryRepository, galaxyParser, fetcher, server);
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
    const threatNotifier = new ThreatNotifier(self.registration);
    const analyzerSettings = await configManager.prepareConfig(ANALYZER_DEFAULTS, 'analyzer');
    const analyzer = new RaidReportAnalyzer(universe, flightCalc, costCalc, analyzerSettings);
    const raiderSettings = await configManager.prepareConfig(RAIDER_DEFAULTS, 'raider');
    const raider = new Raider(player, galaxyRepository, espionageRepository, espionageScrapper, eventLoader, analyzer, launcher, threatNotifier, raiderSettings);
    const scheduler = new MissionScheduler(launcher);
    const expeditorSettings: ExpeditorSettings = await configManager.prepareConfig(defaultExpeditorSettings as ExpeditorSettings, 'expeditor');
    const expeditor = new Expeditor(launcher, player, expeditorSettings);

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
        threatNotifier,
        analyzer,
        raider,
        scheduler,
        loginService,
        expeditor,
        fleetPageLoader
    );
  }
}
