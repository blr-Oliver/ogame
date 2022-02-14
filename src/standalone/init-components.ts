import {JSDOM} from 'jsdom';
import {DOMEspionageReportParser} from '../browser/parsers/dom/espionage-report-dom';
import {HtmlParser} from '../browser/parsers/dom/HtmlParser';
import {JSONGalaxyParser} from '../browser/parsers/json/galaxy-report-json';
import {GAME_PATH, LOBBY_DOMAIN_URL, LOBBY_LOGIN_URL, ServerContext} from '../common/core/ServerContext';
import {Analyzer} from '../common/services/Analyzer';
import {AutoRaid} from '../common/services/AutoRaid';
import {EspionageReportScrapper} from '../common/services/EspionageReportScrapper';
import {GalaxyObserver} from '../common/services/GalaxyObserver';
import {Scanner} from '../common/services/Scanner';
import {StatefulAutoObserve} from '../common/services/StatefulAutoObserve';
import {LegacyMapper} from '../uncertain/LegacyMapper';
import {LegacyFetcher} from './LegacyFetcher';
import {SqlEspionageRepository} from './repository/SqlEspionageRepository';
import {SqlGalaxyRepository} from './repository/SqlGalaxyRepository';
import {StaticGameContext} from './StaticGameContext';

export const GAME_DOMAIN = 's148-ru.ogame.gameforge.com';
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
  parse(body: string): DocumentFragment {
    return JSDOM.fragment(body);
  }
}
export const espionageReportParser = new DOMEspionageReportParser(htmlParser);
export const galaxyParser = new JSONGalaxyParser();
export const fetcher = new LegacyFetcher();
export const espionageReportScrapper = new EspionageReportScrapper(espionageRepo, espionageReportParser, fetcher, serverContext);
export const galaxyObserver = new GalaxyObserver(galaxyRepo, galaxyParser, fetcher, serverContext);
export const autoObserve = new StatefulAutoObserve(galaxyObserver, galaxyRepo, gameContext);
export const mapper = new LegacyMapper(fetcher, serverContext);
export const scanner = new Scanner(gameContext, mapper);
export const autoRaid = new AutoRaid(gameContext, mapper, espionageReportScrapper, galaxyObserver, espionageRepo, galaxyRepo);
export const analyzer = new Analyzer(gameContext, mapper, espionageRepo, galaxyRepo);
