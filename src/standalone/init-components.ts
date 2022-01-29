import {JSDOM} from 'jsdom';
import {DOMEspionageReportParser} from '../browser/parsers/espionage-reports';
import {DOMGalaxyParser} from '../browser/parsers/galaxy-reports';
import {HtmlParser} from '../browser/parsers/HtmlParser';
import {Analyzer} from '../common/core/Analyzer';
import {AutoRaid} from '../common/core/AutoRaid';
import {Scanner} from '../common/core/Scanner';
import {ServerContext} from '../common/core/ServerContext';
import {EspionageReportScrapper} from '../uncertain/EspionageReportScrapper';
import {GalaxyObserver} from '../uncertain/GalaxyObserver';
import {LegacyMapper} from '../uncertain/LegacyMapper';
import {LegacyFetcher} from './LegacyFetcher';
import {SqlEspionageRepository} from './repository/SqlEspionageRepository';
import {SqlGalaxyRepository} from './repository/SqlGalaxyRepository';
import {StaticGameContext} from './StaticGameContext';

export const LOBBY_DOMAIN_URL = 'lobby-api.ogame.gameforge.com';
export const LOBBY_LOGIN_URL = 'https://' + LOBBY_DOMAIN_URL + '/users';
export const GAME_DOMAIN = 's148-ru.ogame.gameforge.com';
export const GAME_PATH = '/game/index.php'
export const GAME_URL = 'https://' + GAME_DOMAIN + GAME_PATH;
export const serverContext: ServerContext = {
  serverName: 's148-ru',
  locale: 'ru',
  domain: GAME_DOMAIN,
  gamePath: GAME_PATH,
  gameUrl: GAME_URL,
  lobbyDomainUrl: LOBBY_DOMAIN_URL,
  lobbyLoginUrl: LOBBY_LOGIN_URL
}
export const gameContext = new StaticGameContext();
export const espionageRepo = new SqlEspionageRepository();
export const galaxyRepo = new SqlGalaxyRepository();
export const htmlParser: HtmlParser = {
  parse(body: string): Document | DocumentFragment {
    return JSDOM.fragment(body);
  }
}
export const espionageReportParser = new DOMEspionageReportParser(htmlParser);
export const galaxyParser = new DOMGalaxyParser(htmlParser);
export const fetcher = new LegacyFetcher();
export const espionageReportScrapper = new EspionageReportScrapper(espionageRepo, espionageReportParser, fetcher, serverContext);
export const galaxyObserver = new GalaxyObserver(galaxyRepo, galaxyParser, fetcher, serverContext);
export const mapper = new LegacyMapper(fetcher, serverContext);
export const scanner = new Scanner(gameContext, mapper);
export const autoRaid = new AutoRaid(gameContext, mapper, espionageReportScrapper, galaxyObserver, espionageRepo, galaxyRepo);
export const analyzer = new Analyzer(gameContext, mapper, espionageRepo, galaxyRepo);
