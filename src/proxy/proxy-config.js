function isProxied(url, host) {
  return dnsDomainIs(host, 'ogame.gameforge.com') && !dnsDomainIs(host, 'lobby.ogame.gameforge.com');
}

function FindProxyForURL(url, host) {
  if (isProxied(url, host))
    return 'PROXY localhost:9000; DIRECT';
  return 'DIRECT';
}
