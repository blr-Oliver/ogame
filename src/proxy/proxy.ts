import {SimpleHandleFunction} from 'connect';
import * as fs from 'fs';
import * as HttpMitmProxy from 'http-mitm-proxy';
import {createServer, Options} from 'http-server';
import {URL} from 'url';

type LocalContent = 'pac' | 'shell' | 'src';

const PORT = 9000;
const proxy = HttpMitmProxy();
const COMMON_OPTIONS: Options = {
  cache: -1,
  showDir: true,
  autoIndex: false,
  showDotfiles: false,
  gzip: true,
  cors: true,
  corsHeaders: 'Service-Worker'
};

const proxyHandler = createHttpToFsHandler('./proxy')
const distHandler = createHttpToFsHandler('./dist');
const srcHandler = stripSrcFromPath(createHttpToFsHandler('./src'));

function createHttpToFsHandler(root: string, options?: Options): SimpleHandleFunction {
  if (options)
    options.root = root;
  else
    options = {root};
  let dummy = createServer({
    ...COMMON_OPTIONS,
    ...options
  });
  return (dummy as any).server._events['request'] as SimpleHandleFunction;
}

function stripSrcFromPath(srcHandler: SimpleHandleFunction): SimpleHandleFunction {
  return (req, res) => {
    req.url = req.url!.replace('/src', '/');
    srcHandler(req, res);
  }
}

proxy.onError(function (ctx: HttpMitmProxy.IContext, err?: Error) {
  console.error('proxy error:', err);
});

proxy.onRequest(function (ctx: HttpMitmProxy.IContext, proceed: (error?: Error) => void) {
  let req = ctx.clientToProxyRequest;
  const url = new URL(req.url!, `${ctx.isSSL ? 'https' : 'http'}://${req.headers.host}`);
  if (shouldPwn(url)) {
    let encoding = req.headers['accept-encoding'];
    if (encoding)
      ctx.use(HttpMitmProxy.gunzip);
    ctx.onResponse(pwnIfHtml);
  } else {
    let localType = getLocalContentType(url);
    if (localType) {
      respondWithFile(ctx, localType);
      return;
    }
  }
  proceed();
});

function isInterestedHost(hostname: string): boolean {
  return hostname.endsWith('ogame.gameforge.com') && !hostname.startsWith('lobby');
}

function isDirectLocalhost(url: URL): boolean {
  return url.port === String(PORT) && url.hostname === 'localhost';
}

function getLocalContentType(url: URL): LocalContent | undefined {
  if (isDirectLocalhost(url)) return 'pac';
  if (isInterestedHost(url.hostname.toLowerCase())) {
    let pathname = url.pathname.toLowerCase();
    if (pathname.startsWith('/shell/')) return 'shell';
    if (pathname.startsWith('/src/')) return 'src';
  }
}

function shouldPwn(url: URL) {
  if (url.port && !(url.port === '80' || url.port === '443')) return false;
  if (isInterestedHost(url.hostname.toLowerCase())) {
    let pathname = url.pathname.toLowerCase();
    if (pathname === '/game/index.php') {
      let asJson = url.searchParams.get('asJson');
      let ajax = url.searchParams.get('ajax');
      return !(asJson && asJson !== '0' || ajax && ajax !== '0');
    }
  }
  return false;
}

function pwnIfHtml(ctx: HttpMitmProxy.IContext, proceed: (error?: Error) => void) {
  let contentType = ctx.serverToProxyResponse.headers['content-type'];
  if (contentType?.indexOf('text/html') !== -1)
    ctx.onResponseData(pwn);
  proceed();
}

function pwn(ctx: HttpMitmProxy.IContext, chunk: Buffer, proceed: (error?: Error, chunk?: Buffer) => void) {
  const search = '<head>';
  let injectionPoint = chunk.indexOf(search);
  if (injectionPoint !== -1) {
    injectionPoint += search.length;
    const injection = fs.readFileSync(__dirname + '/inject.htm');
    chunk = Buffer.concat([
      chunk.subarray(0, injectionPoint),
      injection,
      chunk.subarray(injectionPoint)
    ]);
  }
  return proceed(undefined, chunk);
}

function respondWithFile(ctx: HttpMitmProxy.IContext, localType: LocalContent) {
  let handler: SimpleHandleFunction;
  switch (localType) {
    case 'pac':
      handler = proxyHandler;
      break;
    case 'shell':
      handler = distHandler;
      break;
    case 'src':
      handler = srcHandler;
  }
  handler(ctx.clientToProxyRequest, ctx.proxyToClientResponse);
}

proxy.listen({port: PORT});
