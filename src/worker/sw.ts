import {DelegatingEventTarget} from '../common/core/DelegatingEventTarget';
import {serviceWorkerMain} from './main';
import {ServiceWorkerContext} from './ServiceWorkerContext';

declare var self: ServiceWorkerGlobalScope;

const shim = new DelegatingEventTarget();
self.addEventListener('message', e => shim.handleEvent(e));
self.addEventListener('fetch', e => shim.handleEvent(e));

ServiceWorkerContext.init(self, shim)
    .then(context => serviceWorkerMain(self, context));
