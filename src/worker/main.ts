import {parseCoordinates} from '../browser/parsers/parsers-common';
import {processAll} from '../common/common';
import {DebrisGalaxyInfo, ShardedEspionageReport} from '../common/report-types';
import {Coordinates} from '../common/types';
import {ServiceWorkerContext} from './ServiceWorkerContext';
import {wrappingSum} from './utils';

export async function serviceWorkerMain(self: ServiceWorkerGlobalScope, context: ServiceWorkerContext) {
  const {
    shim,
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

  raider.settings.maxTotalSlots = 24;
  raider.settings.maxRaidSlots = 9;
  raider.settings.minFreeSlots = 1;
  raider.settings.excludedOrigins = [];
  raider.settings.desertedTargets = [
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

  async function findProtectedTargets(): Promise<ShardedEspionageReport[]> {
    const targets = await galaxyRepository.findInactiveTargets();
    const reports = await processAll(targets, c => espionageRepository.loadC(c));
    const guarded = reports.filter(report => report.infoLevel > 0 && !isClean(report));

    return guarded;

    function isClean(report: ShardedEspionageReport): boolean {
      if (sumFields(report.fleet!) !== 0) return false;
      if (report.defense && sumFields(report.defense!) !== (report.defense!.antiBallistic || 0) + (report.defense!.interplanetary || 0)) return false;
      return true;
    }

    function sumFields(data: { [key: string]: number }): number {
      let sum = 0;
      for (let key in data)
        sum += data[key];
      return sum;
    }

  }

  type RatedCoordinates = [Coordinates, number];

  async function rankSystemsWithInactiveTargets(unguarded: RatedCoordinates[]): Promise<any> {
    let ratings: number[] = [...Array(499)].fill(0);
    unguarded.forEach(coordinates => ratings[coordinates[0].system - 1] += coordinates[1]);
    return [0, 5, 20, 50].reduce(
        (res, wnd) => (res[wnd] = wrappingSum(ratings, wnd), res),
        {} as { [wnd: string]: number[] });
  }

  const rate: [number, number] = [1, 3];
  const debrisComparator = (a: DebrisGalaxyInfo, b: DebrisGalaxyInfo) =>
      (b.metal * rate[0] + b.crystal * rate[1]) -
      (a.metal * rate[0] + a.crystal * rate[1]);

  async function rateAllDebris() {
    let allDebris = await galaxyRepository.findAllCurrentDebris();
    return allDebris.sort(debrisComparator);
  }

  async function rateHangingDebris() {
    let allDebris = await galaxyRepository.findHangingDebris();
    return allDebris.sort(debrisComparator);
  }

  (self as any)['raider'] = raider;
  (self as any)['scheduler'] = scheduler;
  (self as any)['findUncertainTargets'] = findUncertainTargets;
  (self as any)['findProtectedTargets'] = findProtectedTargets;
  (self as any)['rankSystemsWithInactiveTargets'] = rankSystemsWithInactiveTargets;
  (self as any)['rateAllDebris'] = rateAllDebris;
  (self as any)['rateHangingDebris'] = rateHangingDebris;
}
