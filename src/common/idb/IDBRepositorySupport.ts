import {IDBRepository} from './IDBRepository';

export type IDBRepositoryInitializer = (tx: IDBTransaction, oldVersion: number, newVersion: number) => void;
export type IDBRepositoryFactory<T extends IDBRepository> = (db: IDBDatabase) => T;

export interface IDBRepositorySupport<T extends IDBRepository> {
  init: IDBRepositoryInitializer;
  create: IDBRepositoryFactory<T>;
}
