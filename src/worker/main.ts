import {parseCoordinates} from '../browser/parsers/parsers-common';
import {processAll} from '../common/common';
import {ShardedEspionageReport} from '../common/report-types';
import {condenseGalaxyHistory} from '../common/services/HistoryCondenser';
import {Triplet} from '../common/services/RaidReportAnalyzer';
import {Coordinates, CoordinateType, Researches, sameCoordinates} from '../common/types';
import {findProtectedTargets, findUncertainTargets, launchExpedition, rateAllDebris, rateHangingDebris} from './helpers';
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

  raider.settings.maxTotalSlots = 25;
  raider.settings.maxRaidSlots = 15;
  raider.settings.minFreeSlots = 1;
  raider.settings.excludedOrigins = [];
  let desertedTargets = raider.settings.desertedTargets = [
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

  async function rankInactiveTargets(): Promise<RankInfo[]> {
    const targets = await galaxyRepository.findInactiveTargets();
    const reports = await processAll(targets, c => espionageRepository.loadC(c));
    const ratings = reports.map(report => rateTarget(report));
    const targetsPerGalaxy = ratings.reduce((perGalaxy, target) =>
            (perGalaxy[target[0].galaxy].push(target), perGalaxy),
        [...Array(10)].map(_ => [] as RatedCoordinates[]));
    return targetsPerGalaxy.map(galaxyData => rankSystemsWithInactiveTargets(galaxyData));
  }

  function rateTarget(report: ShardedEspionageReport): RatedCoordinates {
    const buildings = report.buildings;
    const coordinates = report.coordinates;
    const isMoon = coordinates.type === CoordinateType.Moon;
    const isDeserted = desertedTargets.some(deserted => sameCoordinates(deserted, coordinates));
    let production = [0, 0, 0];
    let productionLimit = [Infinity, Infinity, Infinity];
    if (!isMoon) {
      const position = coordinates.position;
      const positionMultiplier = costCalc.getProductionMultiplier(position);
      const baseNaturalProduction = costCalc.data.naturalProduction;
      const naturalProduction = baseNaturalProduction.map((x, i) => x * positionMultiplier[i] * universe.economyFactor);
      if (buildings) {
        const storageLevels = [buildings.metalStorage || 0, buildings.crystalStorage || 0, buildings.deutStorage || 0];
        productionLimit = storageLevels.map(level => costCalc.getStorageCapacity(level)) as Triplet;
      }
      if (buildings && !isDeserted) {
        const mineLevels = [buildings.metalMine || 0, buildings.crystalMine || 0, buildings.deutMine || 0];
        const plasmaMultiplier = xPlasma(report.researches?.plasma);
        const classMultiplier = 1 + (report.playerClass === 'collector' ? 0.25 : 0) + (report.allianceClass === 'trader' ? 0.05 : 0);
        const mineProduction = mineLevels.map((level, i) => costCalc.getProduction(i, level)
            * positionMultiplier[i] * plasmaMultiplier[i] * classMultiplier * universe.economyFactor);
        const energyNeeded = mineLevels.reduce((sum, level, i) => sum + costCalc.getEnergyConsumption(i, level), 0);
        const energyAvailable = report.resources.energy ?? energyNeeded;
        const productionFactor = Math.min(1, energyNeeded ? energyAvailable / energyNeeded : 0);
        production = mineProduction.map((x, i) => x * productionFactor + naturalProduction[i]) as Triplet;
      } else {
        production = naturalProduction as Triplet;
      }
    }
    const rate = [1, 3, 4];
    const resources = [report.resources.metal, report.resources.crystal, report.resources.deuterium] as Triplet;
    const rating = Math.round(production.map((x, i) => (24 * 21 * x + resources[i]) * rate[i]).reduce((a, b) => a + b, 0));
    return [coordinates, rating];
  }

  function xPlasma(level: number = 0): Triplet {
    return [0.01, 0.0066, 0.0033].map(x => 1 + level * x) as Triplet;
  }

  async function rateProximityTargets() {
    const targets = await galaxyRepository.findInactiveTargets();
    const reports = await processAll(targets, c => espionageRepository.loadC(c));

    return analyzer.suggestMissions({
      unexploredTargets: [],
      reports: reports,
      timeShift: 1000 * 3600 * 3,
      bodies: [{
        id: 33821841,
        coordinates: {galaxy: 7, system: 417, position: 6}
      }, {
        id: 33822434,
        coordinates: {galaxy: 7, system: 417, position: 8}
      }],
      researches: {
        impulseDrive: 0,
        combustionDrive: 4,
        hyperspace: 0
      } as Researches,
      fleet: {
        33821841: {
          smallCargo: 28
        },
        33822434: {
          smallCargo: 31
        }
      },
      rating: [1, 2, 4],
      maxReportAge: 1000 * 3600 * 24 * 1000,
      minRaid: 1,
      maxMissions: 6,
      desertedPlanets: [],
      ignoreBuildingProduction: true,
      maxDistance: 6700
    });
  }

  (self as any)['raider'] = raider;
  (self as any)['scheduler'] = scheduler;
  (self as any)['findUncertainTargets'] = () => findUncertainTargets(galaxyRepository, espionageRepository);
  (self as any)['findProtectedTargets'] = () => findProtectedTargets(galaxyRepository, espionageRepository);
  (self as any)['rankInactiveTargets'] = rankInactiveTargets;
  (self as any)['rateAllDebris'] = () => rateAllDebris(galaxyRepository);
  (self as any)['rateHangingDebris'] = () => rateHangingDebris(galaxyRepository);
  const expo = (from: number, g: number, s: number) => launchExpedition(launcher, from, g, s);
  (self as any)['launchExpedition'] = expo;
  (self as any)['expo1'] = () => expo(33811468, 7, 329);
  (self as any)['expo2'] = () => expo(33813378, 3, 242);
  (self as any)['condenseHistory'] = () => condenseGalaxyHistory(galaxyHistoryRepository);
  (self as any)['rateProximityTargets'] = rateProximityTargets;
}
