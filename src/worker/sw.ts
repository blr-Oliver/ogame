import {serviceWorkerMain} from './main';
import {ReplayingEventShim} from './ReplayingEventShim';
import {ServiceWorkerContext} from './ServiceWorkerContext';

declare var self: ServiceWorkerGlobalScope;
declare var navigator: WorkerNavigator & { locks: LockManager };

const shim = ReplayingEventShim.shim(self, false, 'message', 'fetch');

ServiceWorkerContext.init(self, shim, navigator.locks)
    .then(context => {
      (self as any)['context'] = context;
      return serviceWorkerMain(self, context);
    });
