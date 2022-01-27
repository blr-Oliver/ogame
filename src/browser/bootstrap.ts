import {IDBRepositoryProvider} from '../common/idb/IDBRepositoryProvider';
import {IDBEspionageRepositorySupport} from '../common/idb/repositories/IDBEspionageRepositorySupport';
import {IDBGalaxyRepository} from '../common/idb/repositories/IDBGalaxyRepository';
import {IDBGalaxyRepositorySupport} from '../common/idb/repositories/IDBGalaxyRepositorySupport';
import {ReplyingMessagePort} from '../common/message/ReplyingMessagePort';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
      .register('/sw.js', {
        type: 'classic'
      })
      .then(reg => {
        console.log('Registration succeeded. Scope is ' + reg.scope);
      })
      .catch((error) => {
        console.error('Registration failed with ' + error);
      });
} else {
  console.error('Service workers not supported.')
}

const galaxySupport = new IDBGalaxyRepositorySupport();
const espionageSupport = new IDBEspionageRepositorySupport();
const repositoryProvider: IDBRepositoryProvider = new IDBRepositoryProvider(window.indexedDB, 'ogame', {
  'galaxy': galaxySupport,
  'espionage': espionageSupport
});

repositoryProvider
    .getRepository<IDBGalaxyRepository>('galaxy')
    .then(repo => {
      (window as any).galaxyRepo = repo;
    })
    .catch(e => {
      console.error(e);
    });

if (navigator.serviceWorker.controller) {
  ReplyingMessagePort.connect('exchange', navigator.serviceWorker.controller!, navigator.serviceWorker)
      .then(exchange => {
        (window as any).exchange = exchange;
      });
}
