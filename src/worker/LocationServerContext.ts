import {GAME_PATH, LOBBY_DOMAIN_URL, LOBBY_LOGIN_URL, ServerContext} from '../common/core/ServerContext';

export class LocationServerContext implements ServerContext {
  readonly domain: string;
  readonly gamePath: string;
  readonly gameUrl: string;
  readonly lobbyDomainUrl: string;
  readonly lobbyLoginUrl: string;
  readonly locale: string;
  readonly serverName: string;

  constructor(location: WorkerLocation) {
    this.domain = location.hostname;
    this.gamePath = GAME_PATH;
    this.gameUrl = location.origin + GAME_PATH;
    this.lobbyDomainUrl = LOBBY_DOMAIN_URL;
    this.lobbyLoginUrl = LOBBY_LOGIN_URL;
    let parsed = /([\w\d]+-(\w{1,2}))\..*/.exec(location.hostname)!;
    this.serverName = parsed[1];
    this.locale = parsed[2];
  }
}
