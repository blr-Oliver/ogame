import {JSDOM} from 'jsdom';
import {DOMEspionageReportParser} from '../browser/parsers/dom/espionage-report-dom';
import {HtmlParser} from '../browser/parsers/dom/HtmlParser';
import {JSONGalaxyParser} from '../browser/parsers/json/galaxy-report-json';
import {CachingCostCalculator} from '../common/core/calculator/CostCalculator';
import {FlightCalculator, StaticFlightCalculator} from '../common/core/calculator/FlightCalculator';
import {GAME_PATH, LOBBY_DOMAIN_URL, LOBBY_LOGIN_URL, ServerContext} from '../common/core/ServerContext';
import {UniverseContext} from '../common/core/UniverseContext';
import {Analyzer} from '../common/services/Analyzer';
import {AutoRaidImpl} from '../common/services/AutoRaidImpl';
import {NoDOMPlayerContext} from '../common/services/context/NoDOMPlayerContext';
import {NoDOMUniverseContext} from '../common/services/context/NoDOMUniverseContext';
import {EspionageReportScrapper} from '../common/services/EspionageReportScrapper';
import {GalaxyObserver} from '../common/services/GalaxyObserver';
import {ReportProcessor} from '../common/services/ReportProcessor';
import {Scanner} from '../common/services/Scanner';
import {StatefulAutoObserve} from '../common/services/StatefulAutoObserve';
import {LegacyMapper} from '../uncertain/LegacyMapper';
import {LegacyFetcher} from './LegacyFetcher';
import {SqlEspionageRepository} from './repository/SqlEspionageRepository';
import {SqlGalaxyRepository} from './repository/SqlGalaxyRepository';

export let universeContext: UniverseContext;
export let autoRaid: AutoRaidImpl;
export let analyzer: Analyzer;
export let autoObserve: StatefulAutoObserve;
export let flightCalculator: FlightCalculator;
export let reportProcessor: ReportProcessor;

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
export const costCalculator = new CachingCostCalculator();
export const espionageRepo = new SqlEspionageRepository();
export const galaxyRepo = new SqlGalaxyRepository();
export const htmlParser: HtmlParser = {
  parse(body: string): DocumentFragment {
    return JSDOM.fragment(body);
  }
};
export const galaxyParser = new JSONGalaxyParser();
export const espionageReportParser = new DOMEspionageReportParser(htmlParser);
export const espionageReportScrapper = new EspionageReportScrapper(espionageRepo, espionageReportParser, fetcher, serverContext);
export const mapper = new LegacyMapper(fetcher, serverContext);
export const scanner = new Scanner(playerContext, mapper);
export const galaxyObserver = new GalaxyObserver(galaxyRepo, galaxyParser, fetcher, serverContext);

(async function () {
  universeContext = await NoDOMUniverseContext.acquire(fetcher, serverContext);
  flightCalculator = new StaticFlightCalculator(universeContext);
  reportProcessor = new ReportProcessor(universeContext, flightCalculator, costCalculator);
  autoRaid = new AutoRaidImpl(playerContext, mapper, mapper, espionageReportScrapper, galaxyObserver, espionageRepo, galaxyRepo, reportProcessor, flightCalculator);
  analyzer = new Analyzer(playerContext, mapper, espionageRepo, galaxyRepo, reportProcessor);
  autoObserve = new StatefulAutoObserve(galaxyObserver, galaxyRepo, universeContext);
})();
