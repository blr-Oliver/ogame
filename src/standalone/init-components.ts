import {JSDOM} from 'jsdom';
import {DOMEspionageReportParser} from '../browser/parsers/dom/espionage-report-dom';
import {HtmlParser} from '../browser/parsers/dom/HtmlParser';
import {JSONGalaxyParser} from '../browser/parsers/json/galaxy-report-json';
import {cacheAsyncResult} from '../common/core/cached-async';
import {GAME_PATH, LOBBY_DOMAIN_URL, LOBBY_LOGIN_URL, ServerContext} from '../common/core/ServerContext';
import {UniverseContext} from '../common/core/UniverseContext';
import {Analyzer} from '../common/services/Analyzer';
import {AutoRaidImpl} from '../common/services/AutoRaidImpl';
import {NoDOMPlayerContext} from '../common/services/context/NoDOMPlayerContext';
import {NoDOMUniverseContext} from '../common/services/context/NoDOMUniverseContext';
import {EspionageReportScrapper} from '../common/services/EspionageReportScrapper';
import {GalaxyObserver} from '../common/services/GalaxyObserver';
import {Scanner} from '../common/services/Scanner';
import {StatefulAutoObserve} from '../common/services/StatefulAutoObserve';
import {LegacyMapper} from '../uncertain/LegacyMapper';
import {LegacyFetcher} from './LegacyFetcher';
import {SqlEspionageRepository} from './repository/SqlEspionageRepository';
import {SqlGalaxyRepository} from './repository/SqlGalaxyRepository';

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
export const fetcher = new LegacyFetcher();
export const playerContext = new NoDOMPlayerContext(serverContext, fetcher);
export const universeContextSupplier = cacheAsyncResult(() => NoDOMUniverseContext.acquire(fetcher, serverContext));
export let universeContext: UniverseContext;
universeContextSupplier().then(result => universeContext = result);
export const espionageRepo = new SqlEspionageRepository();
export const galaxyRepo = new SqlGalaxyRepository();
export const galaxyRepoSupplier = () => Promise.resolve(galaxyRepo);
export const htmlParser: HtmlParser = {
  parse(body: string): DocumentFragment {
    return JSDOM.fragment(body);
  }
}
export const espionageReportParser = new DOMEspionageReportParser(htmlParser);
export const galaxyParser = new JSONGalaxyParser();
export const espionageReportScrapper = new EspionageReportScrapper(espionageRepo, espionageReportParser, fetcher, serverContext);
export const galaxyObserver = new GalaxyObserver(galaxyRepoSupplier, galaxyParser, fetcher, serverContext);
export const autoObserve = new StatefulAutoObserve(galaxyObserver, galaxyRepoSupplier, universeContextSupplier);
export const mapper = new LegacyMapper(fetcher, serverContext);
export const scanner = new Scanner(playerContext, mapper);
export const autoRaid = new AutoRaidImpl(playerContext, mapper, espionageReportScrapper, galaxyObserver, espionageRepo, galaxyRepo);
export const analyzer = new Analyzer(playerContext, mapper, espionageRepo, galaxyRepo);
