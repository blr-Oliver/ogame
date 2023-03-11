export interface ServerContext {
  readonly serverName: string;
  readonly locale: string;
  readonly domain: string;
  readonly gamePath: string;
  readonly gameUrl: string;
  readonly lobbyDomainUrl: string;
  readonly lobbyLoginUrl: string;
}

export const LOBBY_DOMAIN_URL = 'lobby-api.ogame.gameforge.com';
export const LOBBY_LOGIN_URL = 'https://' + LOBBY_DOMAIN_URL + '/users';
export const GAME_PATH = '/game/index.php';
