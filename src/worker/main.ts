import {processAll} from '../common/common';
import {ShardedEspionageReport} from '../common/report-types';
import {condenseGalaxyHistory} from '../common/services/infra/HistoryCondenser';
import {RaidReportAnalyzer, Triplet} from '../common/services/RaidReportAnalyzer';
import {Coordinates} from '../common/types';
import {findProtectedTargets, findUncertainTargets, rateAllDebris, rateHangingDebris} from './helpers';
import {ServiceWorkerContext} from './ServiceWorkerContext';
import {wrappingSum} from './utils';

export async function serviceWorkerMain(self: ServiceWorkerGlobalScope, context: ServiceWorkerContext) {
  const {
    shim,
    galaxyRepository,
    galaxyHistoryRepository,
    espionageRepository,
    galaxyMonitor,
    autoObserve,
    raider,
    scheduler,
    launcher,
    costCalc,
    universe,
    analyzer
  } = context;

  self.addEventListener('fetch', (e: Event) => galaxyMonitor.spyGalaxyRequest(e as FetchEvent));
  shim.relay = true;
  autoObserve.continue();
  raider.continue();

  type RatedCoordinates = [Coordinates, number];

  type RankInfo = {
    0: number[],
    5: number[],
    20: number[],
    50: number[]
  }

  function rankSystemsWithInactiveTargets(unguarded: RatedCoordinates[]): RankInfo {
    let ratings: number[] = [...Array(499)].fill(0);
    unguarded.forEach(coordinates => ratings[coordinates[0].system - 1] += coordinates[1]);
    const result = [0, 5, 20, 50].reduce(
        // @ts-ignore
        (res, wnd) => (res[wnd] = wrappingSum(ratings, wnd), res),
        {} as RankInfo);
    return result;
  }

  async function rankInactiveTargets(withProtected: boolean = false): Promise<RankInfo[]> {
    const targets = await galaxyRepository.findInactiveTargets();
    let reports = await processAll(targets, c => espionageRepository.loadC(c));
    if (!withProtected)
      reports = reports.filter(report => RaidReportAnalyzer.isClean(report));
    const ratings = reports.map(report => rateTarget(report));
    const targetsPerGalaxy = ratings.reduce((perGalaxy, target) =>
            (perGalaxy[target[0].galaxy].push(target), perGalaxy),
        [...Array(10)].map(_ => [] as RatedCoordinates[]));
    return targetsPerGalaxy.map(galaxyData => rankSystemsWithInactiveTargets(galaxyData));
  }

  function rateTarget(report: ShardedEspionageReport): RatedCoordinates {
    const coordinates = report.coordinates;
    const productionData = RaidReportAnalyzer.calculateProduction(report, costCalc, universe.economyFactor);
    const production = productionData.hourly;
    const rate = [1, 3, 4];
    const resources = [report.resources.metal, report.resources.crystal, report.resources.deuterium] as Triplet;
    const rating = Math.round(production.map((x, i) => (24 * 21 * x + resources[i]) * rate[i]).reduce((a, b) => a + b, 0));
    return [coordinates, rating];
  }

  (self as any)['raider'] = raider;
  (self as any)['scheduler'] = scheduler;
  (self as any)['findUncertainTargets'] = () => findUncertainTargets(galaxyRepository, espionageRepository);
  (self as any)['findProtectedTargets'] = () => findProtectedTargets(galaxyRepository, espionageRepository, costCalc);
  (self as any)['rankInactiveTargets'] = rankInactiveTargets;
  (self as any)['rateAllDebris'] = () => rateAllDebris(galaxyRepository);
  (self as any)['rateHangingDebris'] = () => rateHangingDebris(galaxyRepository);
  (self as any)['condenseHistory'] = () => condenseGalaxyHistory(galaxyHistoryRepository);
}
