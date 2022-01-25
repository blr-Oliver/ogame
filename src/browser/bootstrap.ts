import {IDBRepositoryProvider} from '../common/idb/IDBRepositoryProvider';
import {IDBEspionageRepositorySupport} from '../common/idb/repositories/IDBEspionageRepositorySupport';
import {IDBGalaxyRepository} from '../common/idb/repositories/IDBGalaxyRepository';
import {IDBGalaxyRepositorySupport} from '../common/idb/repositories/IDBGalaxyRepositorySupport';

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
    .then(repo => repo.load(1, 1))
    .then(report => {
      console.log(`Info available:`, report);
    })
    .catch(e => {
      console.error(e);
    });
