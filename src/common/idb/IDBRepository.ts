export abstract class IDBRepository {
  protected constructor(protected db: IDBDatabase) {
  }

  protected withTransaction<T>(tx: IDBTransaction, action: (tx: IDBTransaction) => Promise<T>, ensureCommitted: boolean = false): Promise<T> {
    let promise = action(tx);
    if (ensureCommitted) {
      return promise
          .then(res => {
            tx.commit();
            return res;
          })
          .catch(e => {
            tx.abort();
            throw e;
          });
    } else {
      promise
          .then(() => tx.commit())
          .catch(() => tx.abort());
      return promise;
    }
  }
}

