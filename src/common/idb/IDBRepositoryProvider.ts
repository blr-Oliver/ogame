import {IDBConnectionProvider} from './IDBConnectionProvider';
import {IDBRepository} from './IDBRepository';
import {IDBRepositoryInitializer, IDBRepositorySupport} from './IDBRepositorySupport';

export class IDBRepositoryProvider {
  readonly connectionProvider: IDBConnectionProvider;
  private readonly repositories: { [name: string]: IDBRepository };

  constructor(private indexedDB: IDBFactory,
              public readonly dbName: string,
              private factories: { [name: string]: IDBRepositorySupport<IDBRepository> }) {
    const initializers = Object.keys(factories)
        .reduce((list, key) => (list.push(factories[key].init.bind(factories[key])), list), [] as IDBRepositoryInitializer[]);
    this.connectionProvider = new IDBConnectionProvider(indexedDB, dbName, initializers);
    this.repositories = {};
  }

  getRepository<T extends IDBRepository>(name: string): Promise<T> {
    if (name in this.repositories)
      return Promise.resolve(this.repositories[name] as T);
    if (!(name in this.factories))
      return Promise.reject('No such repository');
    let support: IDBRepositorySupport<T> = this.factories[name] as IDBRepositorySupport<T>;
    return this.connectionProvider.connect()
        .then(db => support.create(db))
        .then(repo => this.repositories[name] = repo);
  }
}
