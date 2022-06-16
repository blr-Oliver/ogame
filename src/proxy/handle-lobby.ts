import * as HttpMitmProxy from 'http-mitm-proxy';

export function handleLobbyForward(ctx: HttpMitmProxy.IContext, proceed: (error?: Error) => void) {
  const outOptions = ctx.proxyToServerRequestOptions;
  outOptions.host = 'lobby.ogame.gameforge.com';
  outOptions.path = outOptions.path.replace('/lobby', '');
  outOptions.headers['host'] = outOptions.host;
  outOptions.headers['referer'] = `https://${outOptions.host}`;
  return proceed();
}
