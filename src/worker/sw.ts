import {DelegatingEventTarget} from '../common/core/DelegatingEventTarget';
import {serviceWorkerMain} from './main';
import {ServiceWorkerContext} from './ServiceWorkerContext';

declare var self: ServiceWorkerGlobalScope;

const shim = new DelegatingEventTarget();
shim.shim(self, 'message', 'fetch');

ServiceWorkerContext.init(self, shim)
    .then(context => serviceWorkerMain(self, context));
