import {getCurrentClientId} from '../common/client-id';
import {NativeFetcher} from '../common/core/NativeFetcher';
import {RestrainedFetcher} from '../common/core/RestrainedFetcher';
import {IDBRepository} from '../common/idb/IDBRepository';
import {IDBRepositoryProvider} from '../common/idb/IDBRepositoryProvider';
import {IDBEspionageRepository} from '../common/idb/repositories/IDBEspionageRepository';
import {IDBEspionageRepositorySupport} from '../common/idb/repositories/IDBEspionageRepositorySupport';
import {IDBGalaxyRepositorySupport} from '../common/idb/repositories/IDBGalaxyRepositorySupport';
import {MessageChannelWithFactory} from '../common/message/MessageChannelWithFactory';
import {AutoObserveStub} from '../common/remote/AutoObserveStub';
import {GalaxyRepository} from '../common/repository-types';
import {LocationServerContext} from '../common/services/context/LocationServerContext';
import {EspionageReportScrapper} from '../common/services/EspionageReportScrapper';
import {NoDOMEspionageReportParser} from './parsers/no-dom/espionage-report-no-dom';
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
  // console.debug(`Creating components`);
  const factory = new ServiceWorkerConnector(() => getCurrentClientId(navigator.locks));
  // console.debug(`Factory created`);
  const channel = new MessageChannelWithFactory(factory);
  // console.debug(`Channel created (might be not ready)`);
  const autoObserve = new AutoObserveStub(channel);
  // console.debug(`AutoObserve stub created (might be not ready)`);
  (window as any)['autoObserve'] = autoObserve;
  const fetcher = new RestrainedFetcher(new NativeFetcher());
  const serverContext = new LocationServerContext(window.location);

  const galaxyRepositorySupport = new IDBGalaxyRepositorySupport();
  const espionageRepositorySupport = new IDBEspionageRepositorySupport();
  const repositoryProvider = new IDBRepositoryProvider(self.indexedDB, 'ogame', {
    'galaxy': galaxyRepositorySupport,
    'espionage': espionageRepositorySupport
  });
  const espionageParser = new NoDOMEspionageReportParser();

  Promise.all([
    repositoryProvider.getRepository<IDBEspionageRepository>('espionage'),
    repositoryProvider.getRepository<IDBRepository & GalaxyRepository>('galaxy')
  ]).then(([espionageRepo, galaxyRepo]) => {
    (window as any)['espionageRepo'] = espionageRepo;
    (window as any)['galaxyRepo'] = galaxyRepo;
    const espionageScrapper = new EspionageReportScrapper(espionageRepo, espionageParser, fetcher, serverContext);
    (window as any)['espionageScrapper'] = espionageScrapper;
  });
} else {
  console.error('Service workers not supported.')
}
