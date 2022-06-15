import {SimpleHandleFunction} from 'connect';
import * as HttpMitmProxy from 'http-mitm-proxy';
import {URL} from 'url';
import {handleMainPage} from './handle-inject';
import {createHttpToFsHandler, reroute} from './http-to-fs';

type RouteName = 'browser' | 'src' | 'lobby';

const PORT = 9000;
const proxy = HttpMitmProxy();

const proxyHandler = createHttpToFsHandler('./proxy')
const distHandler = createHttpToFsHandler('./dist');
const srcHandler = reroute('/src', '/', createHttpToFsHandler('./src'));

proxy.onError(function (ctx: HttpMitmProxy.IContext, err?: Error) {
  console.error('proxy error:', err);
});

proxy.onRequest(function (ctx: HttpMitmProxy.IContext, proceed: (error?: Error) => void) {
  let req = ctx.clientToProxyRequest;
  const reqUrl = new URL(req.url!, `${ctx.isSSL ? 'https' : 'http'}://${req.headers.host}`);
  if (isDirectLocalhost(reqUrl)) {
    return proxyHandler(ctx.clientToProxyRequest, ctx.proxyToClientResponse);
  }
  const reqHost = reqUrl.hostname.toLowerCase();
  if (isOgameHost(reqHost)) {
    if (reqHost.startsWith('lobby')) {
      return handleLobbyRequest(ctx, reqUrl, proceed);
    } else {
      return handleGameRequest(ctx, reqUrl, proceed);
    }
  } else
    return proceed();
});

function handleLobbyRequest(ctx: HttpMitmProxy.IContext, reqUrl: URL, proceed: (error?: Error) => void): void {
  // maybe lobby should also be pwned?
  // for now - just do nothing
  return proceed();
}

function handleGameRequest(ctx: HttpMitmProxy.IContext, reqUrl: URL, proceed: (error?: Error) => void): void {
  const reqPort: number = +reqUrl.port || 0;
  if (!isDefaultPort(ctx.isSSL, reqPort)) { // websocket, very likely auction/chat
    // just don't care about this yet
  } else {
    if (isMainPage(reqUrl))
      return handleMainPage(ctx, proceed);
    else {
      const route = getRoute(reqUrl);
      if (route)
        return handleRoute(route, ctx, proceed);
    }
  }
  return proceed();
}

function isDefaultPort(isSSL: boolean, port: number): boolean {
  return !port || port === (isSSL ? 443 : 80);
}

function isOgameHost(hostname: string) {
  return hostname.endsWith('ogame.gameforge.com');
}

function isInterestedHost(hostname: string): boolean {
  return isOgameHost(hostname) && !hostname.startsWith('lobby');
}

function isDirectLocalhost(url: URL): boolean {
  return url.port === String(PORT) && url.hostname === 'localhost';
}

function getRoute(url: URL): RouteName | undefined {
  if (isInterestedHost(url.hostname.toLowerCase())) {
    let pathname = url.pathname.toLowerCase();
    if (pathname.startsWith('/src/')) return 'src';
    if (pathname.startsWith('/lobby/')) return 'lobby';
    if (pathname.startsWith('/sw.js') || pathname.startsWith('/browser/')) return 'browser';
  }
}

function isMainPage(url: URL): boolean {
  const pathname = url.pathname.toLowerCase();
  if (pathname === '/game/index.php') {
    const asJson = url.searchParams.get('asJson');
    const ajax = url.searchParams.get('ajax');
    return !(asJson && asJson !== '0' || ajax && ajax !== '0');
  }
  return false;
}

function handleRoute(route: RouteName, ctx: HttpMitmProxy.IContext, proceed: (error?: Error) => void): void {
  let handler: SimpleHandleFunction;
  switch (route) {
    case 'browser':
      handler = distHandler;
      break;
    case 'src':
      handler = srcHandler;
      break;
    case 'lobby':
      console.log('lobby request accepted');
    default:
      return proceed();
  }
  handler(ctx.clientToProxyRequest, ctx.proxyToClientResponse);
}

proxy.listen({port: PORT});
