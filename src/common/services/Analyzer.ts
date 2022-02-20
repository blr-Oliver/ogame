import {getNearest, processAll} from '../common';
import {CachingCostCalculator, CostCalculator} from '../core/calculator/CostCalculator';
import {FlightCalculator, StaticFlightCalculator} from '../core/calculator/FlightCalculator';
import {PlayerContext} from '../core/PlayerContext';
import {ShardedEspionageReport} from '../report-types';
import {EspionageRepository, GalaxyRepository} from '../repository-types';
import {Coordinates, MissionType, Researches, SpaceBody} from '../types';
import {Mapper} from './Mapper';

export interface ReportMetaInfo {
  nearestPlanetId?: number;
  distance?: number;
  production?: number[];
  capacity?: number[];
  flightTime?: number;
  expectedResources?: number[];
  expectedPlunder?: number[];
  requiredTransports?: number;
  fuelCost?: number;
  loadRatio?: number;
  minutesStale?: number;
  value?: number;
  old?: number;
  rating?: number;
  excluded?: boolean;
}

export type ProcessedReport = ShardedEspionageReport & { meta: ReportMetaInfo };

export class Analyzer {
  coordinates: Coordinates[] = [];
  reports: ProcessedReport[] = [];
  excludedTargets: Coordinates[] = [];

  constructor(private context: PlayerContext,
              private mapper: Mapper,
              private espionageRepo: EspionageRepository,
              private galaxyRepo: GalaxyRepository,
              private costCalculator: CostCalculator = CachingCostCalculator.DEFAULT,
              private flightCalculator: FlightCalculator = StaticFlightCalculator.DEFAULT) {
  }

  async load(): Promise<ProcessedReport[]> {
    let targets = await this.galaxyRepo.findInactiveTargets();
    let reports = await processAll(targets, c => this.espionageRepo.loadC(c));
    this.coordinates = reports.map(report => report.coordinates);
    this.reports = reports
        .map(report => ({meta: {}, ...report}) as ProcessedReport)
        .filter(report => {
          let to = report.coordinates;
          if (!report.fleet || !report.defense) {
            console.log(`insufficient report details for [${to.galaxy}:${to.system}:${to.position}]`);
            return false;
          }
          if (this.sumValues(report.fleet) > 0 || this.sumValues(report.defense, 'antiBallistic', 'interplanetary') > 0) {
            console.log(`target is not clean [${to.galaxy}:${to.system}:${to.position}]`);
            return false;
          }
          if (this.excludedTargets.some(c => c.galaxy === to.galaxy && c.system === to.system && c.position === to.position)) {
            console.debug(`target is explicitly excluded [${to.galaxy}:${to.system}:${to.position}]`);
            return false;
          }
          return true;
        });
    const [bodies, researches] = await Promise.all([this.context.getBodies(), this.context.getResearches()]);
    this.rate(bodies, researches);
    return this.reports;
  }

  private sumValues(obj: any, ...skipFields: string[]): number {
    return Object.keys(obj).reduce((sum: number, key) => {
      if (!skipFields || !skipFields.length || skipFields.every(field => field !== key)) sum += obj[key];
      return sum;
    }, 0)
  }

  rate(bodies: SpaceBody[], researches: Researches) {
    this.computeFlight(bodies, researches);
    this.computeProductionAndCapacity();
    this.computePlunder(researches);
    this.computeRatingAndSort();
  }
  /**
   * @deprecated should not be used directly
   */
  async scan(top: number, threshold: number = 20) {
    const [bodies, researches] = await Promise.all([this.context.getBodies(), this.context.getResearches()]);

    this.rate(bodies, researches);
    let targetsToScan: ProcessedReport[] = [];
    let count = Math.min(top, this.reports.length);
    for (let i = 0; i < count; ++i) {
      if (this.reports[i].meta.minutesStale! > threshold)
        targetsToScan.push(this.reports[i]);
    }
    // not waiting for all launches
    processAll(targetsToScan, report => this.mapper.launch({
      from: report.meta.nearestPlanetId,
      to: report.coordinates,
      fleet: {espionageProbe: 1},
      mission: MissionType.Espionage
    }));

    return targetsToScan.length;
  }

  /**
   * @deprecated should not be used directly
   */
  async launch(top: number) {
    let targetsToLaunch = this.reports.slice(0, top);

    return processAll(targetsToLaunch, report => {
      if (report.playerStatus.toLowerCase().indexOf('i') < 0) {
        let to = report.coordinates;
        console.log(`target is not inactive [${to.galaxy}:${to.system}:${to.position}]`);
      }
      return this.mapper.launch({
        from: report.meta.nearestPlanetId,
        to: report.coordinates,
        fleet: {smallCargo: report.meta.requiredTransports},
        mission: MissionType.Attack
      });
    })
  }

  private computeFlight(bodies: SpaceBody[], researches: Researches) {
    this.reports.forEach(report => {
      let nearestBody = getNearest(bodies, report.coordinates, this.flightCalculator);
      let nearestDistance = report.meta.distance = this.flightCalculator.distanceC(report.coordinates, nearestBody.coordinates);
      report.meta.nearestPlanetId = nearestBody.id;
      report.meta.flightTime = this.flightCalculator.flightTime(nearestDistance, this.flightCalculator.fleetSpeed({smallCargo: 1}, researches));
    });
  }

  private computeProductionAndCapacity() {
    this.reports.forEach(report => {
      if (report.buildings) {
        let storageLevels: number[] = [report.buildings.metalStorage, report.buildings.crystalStorage, report.buildings.deutStorage];
        report.meta.capacity = storageLevels.map(l => this.costCalculator.getStorageCapacity(l));

        let mineLevels: number[] = [report.buildings.metalMine, report.buildings.crystalMine, report.buildings.deutMine];
        let unconstrainedProduction = mineLevels.map((l, i) => this.costCalculator.getProduction(i, l));
        let energyConsumption = mineLevels.map((l, i) => this.costCalculator.getEnergyConsumption(i, l));
        let requiredEnergy = energyConsumption.reduce((a, b) => a + b);
        let efficiency = Math.min(1, report.resources.energy! / requiredEnergy);

        let mineProduction = unconstrainedProduction.map(x => x * efficiency);
        if (report.researches) {
          let plasmaLevel = report.researches.plasma;
          let bonus = [0.01, 0.0066, 0.0033].map(x => x * plasmaLevel);
          mineProduction = mineProduction.map((x, i) => x + x * bonus[i]);
        }

        report.meta.production = mineProduction.map((x, i) => x + this.costCalculator.naturalProduction[i]);
      } else {
        report.meta.capacity = Array(3).fill(Infinity);
        report.meta.production = this.costCalculator.naturalProduction.slice();
      }
    });
  }

  private computePlunder(researches: Researches) {
    const now = Date.now();
    const transportCapacity = 5000 * (1 + (researches.hyperspace || 0) * 0.05);
    this.reports.forEach(report => {
      let time = (now - report.source[0].timestamp.getTime() + report.meta.flightTime! * 1000) / 1000 / 3600;
      let original = [report.resources.metal || 0, report.resources.crystal || 0, report.resources.deuterium || 0];
      let andProduced = report.meta.production!.map((x, i) => x * time + original[i]);
      let expected = report.meta.expectedResources = andProduced.map((x, i) => Math.max(Math.min(x, report.meta.capacity![i]), original[i]));
      let requiredCapacity = this.flightCalculator.capacityFor(expected[0] / 2, expected[1] / 2, expected[2] / 2);
      let nTransports = report.meta.requiredTransports = Math.ceil(requiredCapacity / transportCapacity);
      report.meta.fuelCost = this.flightCalculator.fuelConsumption(report.meta.distance!, {smallCargo: nTransports}, researches, report.meta.flightTime);
      let actualCapacity = nTransports * transportCapacity;
      report.meta.expectedPlunder = this.flightCalculator.plunderWith(expected[0], expected[1], expected[2], actualCapacity);
      report.meta.minutesStale = Math.floor((now - report.source[0].timestamp.getTime()) / 1000 / 60);
    });
  }

  private computeRatingAndSort(rate: number[] = [0.5, 1.2, 1.5]) {
    this.reports.forEach(report => {
      let value = report.meta.expectedPlunder!.reduce((total, value, i) => total + value * rate[i], 0);
      report.meta.rating = (value - report.meta.fuelCost! * rate[2]) / report.meta.flightTime!;
    });

    this.reports.sort((a, b) => b.meta.rating! - a.meta.rating!);
  }
}
