import {JSDOM} from 'jsdom';
import {GAME_PATH, LOBBY_DOMAIN_URL, LOBBY_LOGIN_URL, ServerContext} from 'ogame-core/context/ServerContext';
import {UniverseContext} from 'ogame-core/context/UniverseContext';
import {HtmlParser} from '../browser/parsers/dom/HtmlParser';
import {JSONGalaxyParser} from '../common/parsers/json/galaxy-report-json';
import {NoDOMEspionageReportParser} from '../common/parsers/no-dom/espionage-report-no-dom';
import {AutoObserve} from '../common/services/AutoObserve';
import {NoDOMPlayerContext} from '../common/services/context/NoDOMPlayerContext';
import {NoDOMUniverseContext} from '../common/services/context/NoDOMUniverseContext';
import {EspionageReportScrapper} from '../common/services/operations/EspionageReportScrapper';
import {GalaxyObserver} from '../common/services/operations/GalaxyObserver';
import {StatefulAutoObserve} from '../common/services/StatefulAutoObserve';
import {LegacyMapper} from '../uncertain/LegacyMapper';
import {CachingCostCalculator} from '../uniplatform/core/calculator/CostCalculator';
import {FlightCalculator, StaticFlightCalculator} from '../uniplatform/core/calculator/FlightCalculator';
import {LegacyFetcher} from './LegacyFetcher';
import {SqlEspionageRepository} from './repository/SqlEspionageRepository';
import {SqlGalaxyRepository} from './repository/SqlGalaxyRepository';

export let universeContext: UniverseContext;
export let autoObserve: AutoObserve;
export let flightCalculator: FlightCalculator;

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
export const espionageReportParser = new NoDOMEspionageReportParser();
export const espionageReportScrapper = new EspionageReportScrapper(espionageRepo, espionageReportParser, fetcher, serverContext);
export const mapper = new LegacyMapper(fetcher, serverContext);
export const galaxyObserver = new GalaxyObserver(galaxyRepo, galaxyParser, fetcher, serverContext);

(async function () {
  universeContext = await NoDOMUniverseContext.acquire(fetcher, serverContext);
  flightCalculator = new StaticFlightCalculator(universeContext);
  autoObserve = new StatefulAutoObserve(galaxyObserver, galaxyRepo, universeContext, {
    timeout: 3600 * 2,
    emptyTimeout: 3600 * 36,
    delay: 20
  });
})();
