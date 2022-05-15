import {parseCoordinates} from '../browser/parsers/parsers-common';
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
    analyzer,
    scheduler
  } = context;

  self.addEventListener('fetch', (e: Event) => galaxyMonitor.spyGalaxyRequest(e as FetchEvent));
  shim.relay = true;
  autoObserve.continue();

  analyzer.ignoreBuildingProduction = true;
  raider.maxTotalSlots = 24;
  raider.maxRaidSlots = 0;
  raider.minFreeSlots = 2;
  raider.excludedOrigins = [];
  raider.desertedTargets = [
    '[3:206:8]',
    '[3:240:10]',
    '[3:240:12]',
    '[3:241:13]',
    '[3:244:5]',
    '[3:244:6]',
    '[3:244:7]',
    '[3:247:6]',
    '[3:247:6]',
    '[3:273:8]',
    '[4:191:15]',
    '[4:388:5]',
    '[4:388:7]',
    '[4:388:8]',
    '[4:392:7]',
    '[4:397:4]',
    '[4:398:4]',
    '[4:398:14]',
    '[4:399:14]',
    '[4:455:8]',
    '[5:14:7]',
    '[5:18:7]',
    '[6:6:7]',
    '[6:23:12]',
    '[6:36:1]',
    '[6:36:4]',
    '[6:36:6]',
    '[6:36:10]',
    '[6:37:8]',
    '[6:47:13]',
    '[6:105:15]',
    '[6:135:14]',
    '[6:139:15]',
    '[6:245:6]',
    '[6:495:9]',
    '[7:329:8]',
    '[7:329:9]',
    '[7:329:10]',
    '[7:331:10]',
    '[7:332:8]'
  ].map(s => parseCoordinates(s)!);
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

  async function rateDebrisFields() {
    let allDebris = await galaxyRepository.findAllCurrentDebris();
    const rate: [number, number] = [1, 3];
    return allDebris.sort((a, b) =>
        (b.metal * rate[0] + b.crystal * rate[1]) -
        (a.metal * rate[0] + a.crystal * rate[1])
    );
  }

  (self as any)['raider'] = raider;
  (self as any)['scheduler'] = scheduler;
  (self as any)['findUncertainTargets'] = findUncertainTargets;
  // (self as any)['rateInactiveTargets'] = rateInactiveTargets;
  (self as any)['rankSystemsWithInactiveTargets'] = rankSystemsWithInactiveTargets;
  (self as any)['rateDebrisFields'] = rateDebrisFields;
}
