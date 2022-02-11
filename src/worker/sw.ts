import {DelegatingEventTarget} from '../common/core/DelegatingEventTarget';
import {serviceWorkerMain} from './main';
import {ServiceWorkerContext} from './ServiceWorkerContext';

declare var self: ServiceWorkerGlobalScope;
declare var navigator: WorkerNavigator & { locks: LockManager };

const shim = new DelegatingEventTarget();
shim.shim(self, 'message', 'fetch');

const context = ServiceWorkerContext.init(self, navigator.locks);
serviceWorkerMain(self, context);
