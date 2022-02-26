import {processAll} from '../common/common';
import {ShardedEspionageReport} from '../common/report-types';
import {Coordinates} from '../common/types';
import {ServiceWorkerContext} from './ServiceWorkerContext';
import {wrappingSum} from './utils';

export async function serviceWorkerMain(self: ServiceWorkerGlobalScope, context: ServiceWorkerContext) {
  const {
    shim,
    player,
    galaxyRepository,
    espionageRepository,
    galaxyMonitor,
    autoObserve,
    raider,
    scheduler
  } = context;

  self.addEventListener('fetch', (e: Event) => galaxyMonitor.spyGalaxyRequest(e as FetchEvent));
  shim.relay = true;
  autoObserve.continue();

  raider.maxRaidSlots = 21;
  raider.minFreeSlots = 6;
  raider.continue();

  async function findUncertainTargets(): Promise<{ [infoLevel: number]: ShardedEspionageReport[] }> {
    const targets = await galaxyRepository.findInactiveTargets();
    const reports = await processAll(targets, c => espionageRepository.loadC(c));
    const uncertain = reports.filter(report => report.infoLevel < 4);
    const reportsByLevel: { [infoLevel: number]: ShardedEspionageReport[] } = {0: [], 1: [], 2: [], 3: []};
    uncertain.forEach(report => reportsByLevel[report.infoLevel].push(report));
    return reportsByLevel;
  }

  type RatedCoordinates = [Coordinates, number];

  /*
    async function rateInactiveTargets(galaxy: number = 3) {
      const rate = [1, 3, 4];
      const [researches, bodies] = await Promise.all([player.getResearches(), player.getBodies()]);
      let targets = await galaxyRepository.findInactiveTargets();
      targets = targets.filter(target => target.galaxy === galaxy);
      const reports = await processAll(targets, c => espionageRepository.loadC(c));
      const processed = reports.map(report => reportProcessor.processReport(report, researches, bodies, rate));
      processed.forEach(report => {
        const production = report.meta.production!.map(x => x || 0);
        const resources: number[] = [report.resources.metal || 0, report.resources.crystal || 0, report.resources.deuterium || 0];
        const value: number[] = [];
        let sum = 0;
        for (let i = 0; i < 3; ++i) {
          value[i] = resources[i] + production[i] * 300;
          sum += value[i] * rate[i];
        }
        report.meta.rating = sum;
      });
      processed.sort((a, b) => b.meta.rating! - a.meta.rating!);
      const isUnprotected = (report: ProcessedReport) => {
        let noFleet = Object.keys(report.fleet!).length === 0;
        let defenseClone = Object.assign({}, report.defense!);
        delete defenseClone.interplanetary;
        delete defenseClone.antiBallistic;
        let noDefense = Object.keys(defenseClone).length === 0;
        return noFleet && noDefense;
      };
      const unguarded = processed.filter(report => isUnprotected(report));
      const guarded = processed.filter(report => !isUnprotected(report));
      return [unguarded.map(report => [report.coordinates, report.meta.rating]), guarded];
    }
  */
  async function rankSystemsWithInactiveTargets(unguarded: RatedCoordinates[]): Promise<any> {
    let ratings: number[] = [...Array(499)].fill(0);
    unguarded.forEach(coordinates => ratings[coordinates[0].system - 1] += coordinates[1]);
    return [0, 5, 20, 50].reduce(
        (res, wnd) => (res[wnd] = wrappingSum(ratings, wnd), res),
        {} as { [wnd: string]: number[] });
  }

  (self as any)['raider'] = raider;
  (self as any)['scheduler'] = scheduler;
  (self as any)['findUncertainTargets'] = findUncertainTargets;
  // (self as any)['rateInactiveTargets'] = rateInactiveTargets;
  (self as any)['rankSystemsWithInactiveTargets'] = rankSystemsWithInactiveTargets;
}
