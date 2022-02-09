import {DelegatingEventTarget} from '../common/core/DelegatingEventTarget';
import {serviceWorkerMain} from './main';
import {ServiceWorkerContext} from './ServiceWorkerContext';

declare var self: ServiceWorkerGlobalScope;
declare var navigator: WorkerNavigator & { locks: LockManager };

const shim = new DelegatingEventTarget();
shim.shim(self, 'message', 'fetch');

ServiceWorkerContext.init(self, navigator.locks)
    .then(context => serviceWorkerMain(self, context));
