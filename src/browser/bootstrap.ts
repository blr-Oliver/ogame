import {getCurrentClientId} from '../common/client-id';
import {cacheAsyncResult} from '../common/core/cached-async';
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
import {AutoRaidImpl} from '../common/services/AutoRaidImpl';
import {LocationServerContext} from '../common/services/context/LocationServerContext';
import {NoDOMPlayerContext} from '../common/services/context/NoDOMPlayerContext';
import {NoDOMUniverseContext} from '../common/services/context/NoDOMUniverseContext';
import {EspionageReportScrapper} from '../common/services/EspionageReportScrapper';
import {GalaxyObserver} from '../common/services/GalaxyObserver';
import {TwoStepLauncher} from '../common/services/TwoStepLauncher';
import {CoordinateType, Mission, MissionType} from '../common/types';
import {DOMEspionageReportParser} from './parsers/dom/espionage-report-dom';
import {NavigatorHtmlParser} from './parsers/dom/HtmlParser';
import {JSONGalaxyParser} from './parsers/json/galaxy-report-json';
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
  const htmlParser = new NavigatorHtmlParser(new DOMParser());

  const galaxyRepositorySupport = new IDBGalaxyRepositorySupport();
  const espionageRepositorySupport = new IDBEspionageRepositorySupport();
  const repositoryProvider = new IDBRepositoryProvider(self.indexedDB, 'ogame', {
    'galaxy': galaxyRepositorySupport,
    'espionage': espionageRepositorySupport
  });
  const galaxyRepoProvider = cacheAsyncResult(() => repositoryProvider.getRepository<IDBGalaxyRepository>('galaxy'));
  const espionageRepoProvider = cacheAsyncResult(() => repositoryProvider.getRepository<IDBEspionageRepository>('espionage'));
  const galaxyParser = new JSONGalaxyParser();
  const galaxyObserver = new GalaxyObserver(galaxyRepoProvider, galaxyParser, fetcher, serverContext);
  const espionageParser = new DOMEspionageReportParser(htmlParser);
  const eventListParser = new NoDOMEventListParser();
  const eventListLoader = new AjaxEventListLoader(fetcher, eventListParser, serverContext);

  espionageRepoProvider().then(espionageRepo => {
    const espionageScrapper = new EspionageReportScrapper(espionageRepo, espionageParser, fetcher, serverContext);
    (window as any)['espionageScrapper'] = espionageScrapper;
    galaxyRepoProvider().then(galaxyRepo => {
      const autoRaid = new AutoRaidImpl(playerContext, launcher, eventListLoader, espionageScrapper, galaxyObserver, espionageRepo, galaxyRepo);
      (window as any)['autoRaid'] = autoRaid;
      autoRaid.state.maxSlots = 13;
      //autoRaid.continue();
    });
  });

  // 9724905
  const mission: Mission = {
    from: 33811468,
    to: {
      galaxy: 7,
      system: 329,
      position: 9,
      type: CoordinateType.Moon
    },
    mission: MissionType.Espionage,
    fleet: {
      espionageProbe: 1
    }
  }
  function getUniverseConfig() {
    return NoDOMUniverseContext.acquire(fetcher, serverContext);
  }
  (window as any)['launcher'] = launcher;
  (window as any)['_mission'] = mission;
  (window as any)['playerContext'] = playerContext;
  (window as any)['getUniverseConfig'] = getUniverseConfig;
} else {
  console.error('Service workers not supported.')
}
