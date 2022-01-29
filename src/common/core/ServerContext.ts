export interface ServerContext {
  readonly serverName: string;
  readonly locale: string;
  readonly domain: string;
  readonly gamePath: string;
  readonly gameUrl: string;
  readonly lobbyDomainUrl: string;
  readonly lobbyLoginUrl: string;
}
