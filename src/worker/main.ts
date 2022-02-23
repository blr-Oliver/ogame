import {processAll} from '../common/common';
import {ShardedEspionageReport} from '../common/report-types';
import {ServiceWorkerContext} from './ServiceWorkerContext';

export async function serviceWorkerMain(self: ServiceWorkerGlobalScope, context: ServiceWorkerContext) {
  const {
    shim,
    galaxyRepository,
    espionageRepository,
    galaxyMonitor,
    autoObserve,
    scanner
  } = context;

  self.addEventListener('fetch', (e: Event) => galaxyMonitor.spyGalaxyRequest(e as FetchEvent));
  autoObserve.continue();
  shim.relay = true;

  async function findUncertainTargets(): Promise<{ [infoLevel: number]: ShardedEspionageReport[] }> {
    const targets = await galaxyRepository.findInactiveTargets();
    const reports = await processAll(targets, c => espionageRepository.loadC(c));
    const uncertain = reports.filter(report => report.infoLevel < 4);
    const reportsByLevel: { [infoLevel: number]: ShardedEspionageReport[] } = {
      0: [],
      1: [],
      2: [],
      3: []
    }
    uncertain.forEach(report => reportsByLevel[report.infoLevel].push(report));
    return reportsByLevel;
  }

  (self as any)['findUncertainTargets'] = findUncertainTargets;
  /*
  rankSystemsWithInactiveTargets(galaxyRepository)
      .then(stats => console.log(stats));
   */
}
