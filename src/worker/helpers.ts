import {processAll} from '../common/common';
import {DebrisGalaxyInfo, ShardedEspionageReport} from '../common/report-types';
import {EspionageRepository, GalaxyRepository} from '../common/repository-types';
import {Launcher} from '../common/services/Mapper';
import {MissionType} from '../common/types';

export async function findUncertainTargets(galaxyRepository: GalaxyRepository, espionageRepository: EspionageRepository): Promise<{ [infoLevel: number]: ShardedEspionageReport[] }> {
  const targets = await galaxyRepository.findInactiveTargets();
  const reports = await processAll(targets, c => espionageRepository.loadC(c));
  const uncertain = reports.filter(report => report.infoLevel < 4);
  const reportsByLevel: { [infoLevel: number]: ShardedEspionageReport[] } = {0: [], 1: [], 2: [], 3: []};
  uncertain.forEach(report => reportsByLevel[report.infoLevel].push(report));
  return reportsByLevel;
}

export async function findProtectedTargets(galaxyRepository: GalaxyRepository, espionageRepository: EspionageRepository): Promise<ShardedEspionageReport[]> {
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

const rate: [number, number] = [1, 3];
const debrisComparator = (a: DebrisGalaxyInfo, b: DebrisGalaxyInfo) =>
    (b.metal * rate[0] + b.crystal * rate[1]) -
    (a.metal * rate[0] + a.crystal * rate[1]);

export async function rateAllDebris(galaxyRepository: GalaxyRepository) {
  let allDebris = await galaxyRepository.findAllCurrentDebris();
  return allDebris.sort(debrisComparator);
}

export async function rateHangingDebris(galaxyRepository: GalaxyRepository) {
  let allDebris = await galaxyRepository.findHangingDebris();
  return allDebris.sort(debrisComparator);
}

export function launchExpedition(launcher: Launcher, from: number, galaxy: number, system: number) {
  launcher.launch({
    from,
    fleet: {
      reaper: 1,
      pathfinder: 1,
      espionageProbe: 1,
      largeCargo: 405 // 402
    },
    mission: MissionType.Expedition,
    to: {
      galaxy,
      system,
      position: 16
    },
    holdTime: 1
  });
}
