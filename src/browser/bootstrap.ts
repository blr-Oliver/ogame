import {getCurrentClientId} from '../common/client-id';
import {CachingCostCalculator} from '../common/core/calculator/CostCalculator';
import {StaticFlightCalculator} from '../common/core/calculator/FlightCalculator';
import {NativeFetcher} from '../common/core/NativeFetcher';
import {RestrainedFetcher} from '../common/core/RestrainedFetcher';
import {IDBRepositoryProvider} from '../common/idb/IDBRepositoryProvider';
import {IDBEspionageRepository} from '../common/idb/repositories/IDBEspionageRepository';
import {IDBEspionageRepositorySupport} from '../common/idb/repositories/IDBEspionageRepositorySupport';
import {IDBGalaxyRepository} from '../common/idb/repositories/IDBGalaxyRepository';
import {IDBGalaxyRepositorySupport} from '../common/idb/repositories/IDBGalaxyRepositorySupport';
import {MessageChannelWithFactory} from '../common/message/MessageChannelWithFactory';
import {AutoObserveStub} from '../common/remote/AutoObserveStub';
import {AjaxEventListLoader} from '../common/services/AjaxEventListLoader';
import {LocationServerContext} from '../common/services/context/LocationServerContext';
import {NoDOMPlayerContext} from '../common/services/context/NoDOMPlayerContext';
import {NoDOMUniverseContext} from '../common/services/context/NoDOMUniverseContext';
import {EspionageReportScrapper} from '../common/services/EspionageReportScrapper';
import {GalaxyObserver} from '../common/services/GalaxyObserver';
import {Raider} from '../common/services/Raider';
import {RaidReportAnalyzer} from '../common/services/RaidReportAnalyzer';
import {ReportProcessor} from '../common/services/ReportProcessor';
import {TwoStepLauncher} from '../common/services/TwoStepLauncher';
import {JSONGalaxyParser} from './parsers/json/galaxy-report-json';
import {NoDOMEspionageReportParser} from './parsers/no-dom/espionage-report-no-dom';
import {NoDOMEventListParser} from './parsers/no-dom/event-list-no-dom';
import {ServiceWorkerConnector} from './ServiceWorkerConnector';

if ('serviceWorker' in navigator) {
  const url = '/sw.js';
  navigator.serviceWorker
      .register(url, {
        type: 'classic'
      })
      .then(reg => {
        console.log(`Service worker from '${url}' registered. Scope is ${reg.scope}`);
      })
      .catch((error) => {
        console.error('Registration failed with ' + error);
      });
  console.debug(`Creating components`);
  const factory = new ServiceWorkerConnector(() => getCurrentClientId(navigator.locks));
  console.debug(`Factory created`);
  const channel = new MessageChannelWithFactory(factory);
  console.debug(`Channel created (might be not ready)`);
  const autoObserve = new AutoObserveStub(channel);
  console.debug(`AutoObserve stub created (might be not ready)`);
  (window as any)['autoObserve'] = autoObserve;
  const fetcher = new RestrainedFetcher(new NativeFetcher());
  const serverContext = new LocationServerContext(window.location);
  const playerContext = new NoDOMPlayerContext(serverContext, fetcher);
  const launcher = new TwoStepLauncher(serverContext, fetcher);

  const galaxyRepositorySupport = new IDBGalaxyRepositorySupport();
  const espionageRepositorySupport = new IDBEspionageRepositorySupport();
  const repositoryProvider = new IDBRepositoryProvider(self.indexedDB, 'ogame', {
    'galaxy': galaxyRepositorySupport,
    'espionage': espionageRepositorySupport
  });
  const galaxyParser = new JSONGalaxyParser();
  const espionageParser = new NoDOMEspionageReportParser();
  const eventListParser = new NoDOMEventListParser();
  const eventListLoader = new AjaxEventListLoader(fetcher, eventListParser, serverContext);

  Promise.all([
    repositoryProvider.getRepository<IDBEspionageRepository>('espionage'),
    repositoryProvider.getRepository<IDBGalaxyRepository>('galaxy'),
    NoDOMUniverseContext.acquire(fetcher, serverContext)
  ]).then(([espionageRepo, galaxyRepo, universe]) => {
    const galaxyObserver = new GalaxyObserver(galaxyRepo, galaxyParser, fetcher, serverContext);
    const flightCalculator = new StaticFlightCalculator(universe);
    const costCalculator = new CachingCostCalculator();
    const reportProcessor = new ReportProcessor(universe, flightCalculator, costCalculator);
    (window as any)['espionageRepo'] = espionageRepo;
    (window as any)['galaxyRepo'] = galaxyRepo;
    const espionageScrapper = new EspionageReportScrapper(espionageRepo, espionageParser, fetcher, serverContext);
    (window as any)['espionageScrapper'] = espionageScrapper;
    const analyzer = new RaidReportAnalyzer(universe, flightCalculator, costCalculator);
    const raider = new Raider(playerContext, galaxyRepo, espionageRepo, espionageScrapper, eventListLoader, analyzer, launcher);
    (window as any)['raider'] = raider;
    raider.minFreeSlots = 2;
    raider.maxRaidSlots = 15;
  });
  (window as any)['launcher'] = launcher;
  (window as any)['playerContext'] = playerContext;
} else {
  console.error('Service workers not supported.')
}
