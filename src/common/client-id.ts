export function getCurrentClientId(locks: LockManager): Promise<string> {
  return new Promise((resolve) => {
    let lockName: string;
    tryGetLock();

    function tryGetLock() {
      lockName = 'get-self-id-' + (Math.random() * 0xffffffff >>> 0);
      locks.request(lockName, {mode: 'exclusive', ifAvailable: true}, withLock);
    }

    function withLock(lock: Lock | null): Promise<any> {
      if (lock)
        return locks.query()
            .then(({held}) => held!.find(lock => lock.name === lockName!)!.clientId!)
            .then(clientId => setTimeout(resolve, 0, clientId))
      else {
        setTimeout(tryGetLock, 0);
        return Promise.resolve();
      }
    }
  })
}
