import {processAll} from '../common/common';
import {CostCalculator} from '../common/core/calculator/CostCalculator';
import {DEFENCE_STATS, SHIP_STATS} from '../common/core/calculator/unit-stats-types';
import {DebrisGalaxyInfo, ShardedEspionageReport} from '../common/core/types/reports';
import {EspionageRepository, GalaxyRepository} from '../common/core/types/repositories';
import {RaidReportAnalyzer, Triplet} from '../common/services/RaidReportAnalyzer';
import {DefensePartial, DefenseType, FleetPartial, ShipType} from '../common/core/types/core';

export async function findUncertainTargets(galaxyRepository: GalaxyRepository, espionageRepository: EspionageRepository): Promise<{ [infoLevel: number]: ShardedEspionageReport[] }> {
  const targets = await galaxyRepository.findInactiveTargets();
  const reports = await processAll(targets, c => espionageRepository.loadC(c));
  const uncertain = reports.filter(report => report.infoLevel < 4);
  const reportsByLevel: { [infoLevel: number]: ShardedEspionageReport[] } = {0: [], 1: [], 2: [], 3: []};
  uncertain.forEach(report => reportsByLevel[report.infoLevel].push(report));
  return reportsByLevel;
}

export async function findProtectedTargets(galaxyRepository: GalaxyRepository,
                                           espionageRepository: EspionageRepository,
                                           costCalculator: CostCalculator): Promise<ShardedEspionageReport[]> {
  type ReportWithAnalysis = ShardedEspionageReport & {
    power?: number,
    longTermValue?: number,
    immediateValue?: number
  }

  const targets = await galaxyRepository.findInactiveTargets();
  const reports = (await processAll(targets, c => espionageRepository.loadC(c))) as ReportWithAnalysis[];
  reports.forEach(r => {
    let [defStructure, defAttack] = calcDefenceValue(r.defense || {});
    let [debrisMetal, debrisCrystal, fleetStructure, fleetAttack] = calcFleetValue(r.fleet || {});
    if (r.researches) {
      let {weaponsUpgrade, armorUpgrade} = r.researches;
      weaponsUpgrade = weaponsUpgrade || 0;
      armorUpgrade = armorUpgrade || 0;
      defStructure *= (1 + armorUpgrade * 0.1);
      fleetStructure *= (1 + armorUpgrade * 0.1);
      defAttack *= (1 + weaponsUpgrade * 0.1);
      fleetAttack *= (1 + weaponsUpgrade * 0.1);
    }
    r.power = fleetAttack + fleetStructure + defAttack * 5 + defStructure * 5;
    if (r.power) {
      const {hourly: production} = RaidReportAnalyzer.calculateProduction(r, costCalculator, 1);
      const rate = [1, 3, 4];
      const loot = (r.loot || 75) / 75;
      const resources = [r.resources.metal, r.resources.crystal, r.resources.deuterium] as Triplet;
      resources[0] = resources[0] * loot + debrisMetal;
      resources[1] = resources[1] * loot + debrisCrystal;
      resources[2] = resources[2] * loot;
      r.immediateValue = resources.map((x, i) => x * rate[i]).reduce((a, b) => a + b, 0);
      r.longTermValue = Math.round(production.map((x, i) => (24 * 35 * x) * rate[i]).reduce((a, b) => a + b, 0));
    }
  });

  const guarded = reports.filter(report => !!report.power);

  return guarded;

  function calcDefenceValue(def: DefensePartial): [number, number] {
    let structure = 0;
    let attack = 0;
    for (let key in def) {
      const defType = key as DefenseType;
      if (defType === 'interplanetary' || defType === 'antiBallistic')
        continue;
      const n = def[defType]!;
      const defStructure = ((DEFENCE_STATS[defType].cost.metal || 0) + (DEFENCE_STATS[defType].cost.crystal || 0)) / 10;
      const defAttack = DEFENCE_STATS[defType].attack;
      structure += n * defStructure;
      attack += n * defAttack;
    }
    return [structure, attack];
  }

  function calcFleetValue(fleet: FleetPartial): [number, number, number, number] {
    let metal = 0;
    let crystal = 0;
    let attack = 0;
    for (let key in fleet) {
      const shipType = key as ShipType;
      const n = fleet[shipType]!;
      const fleetAttack = SHIP_STATS[shipType].attack;
      metal += n * (SHIP_STATS[shipType].cost.metal || 0);
      crystal += n * (SHIP_STATS[shipType].cost.crystal || 0);
      attack += n * fleetAttack;
    }
    return [metal * 0.3, crystal * 0.3, (metal + crystal) / 10, attack];
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
