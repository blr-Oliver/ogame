import {ConfigRepository} from '../../../uniplatform/core/types/repositories';
import {IDBRepository} from '../IDBRepository';
import {IDBUtils} from '../IDBUtils';

const {
  upsertOne,
  getOne,
  deleteAll
} = IDBUtils;

export class IDBConfigRepository extends IDBRepository implements ConfigRepository {
  static readonly OBJ_CONFIG = 'config';

  constructor(db: IDBDatabase) {
    super(db);
  }

  load<T extends object>(name: string, profile: string = 'default'): Promise<T | undefined> {
    let tx = this.db.transaction([IDBConfigRepository.OBJ_CONFIG], 'readonly');
    return this.withTransaction(tx, tx => getOne(tx.objectStore(IDBConfigRepository.OBJ_CONFIG), [name, profile]));
  }

  store<T extends object>(config: T, name: string, profile: string = 'default'): Promise<IDBValidKey> {
    let tx = this.db.transaction([IDBConfigRepository.OBJ_CONFIG], 'readwrite');
    return this.withTransaction(tx, tx => upsertOne(tx.objectStore(IDBConfigRepository.OBJ_CONFIG), config, [name, profile]));
  }

  remove(name: string, profile: string = 'default'): Promise<void> {
    let tx = this.db.transaction([IDBConfigRepository.OBJ_CONFIG], 'readwrite');
    return this.withTransaction(tx, tx => deleteAll(tx.objectStore(IDBConfigRepository.OBJ_CONFIG), [name, profile]))
  }
}
