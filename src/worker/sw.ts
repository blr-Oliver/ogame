import {Router} from './Router';

declare var self: ServiceWorkerGlobalScope;

let router = new Router(self);
