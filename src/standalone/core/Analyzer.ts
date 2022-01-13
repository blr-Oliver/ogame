import {Coordinates, MissionType, ShardedEspionageReport} from '../../common/types';
import {EspionageRepository} from '../repository/EspionageRepository';
import {GalaxyRepository} from '../repository/GalaxyRepository';
import {Calculator} from '../../common/Calculator';
import {FlightCalculator} from '../../common/FlightCalculator';
import {nearestPlanet, PLANETS} from './GameContext';
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

  load(): Promise<ProcessedReport[]> {
    return EspionageRepository.instance.findForInactiveTargets().then(pairs => {
      this.coordinates = pairs.map(pair => pair[0]);
      this.reports = pairs
          .map(pair => ({meta: {}, ...pair[1]}) as ProcessedReport)
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
              console.log(`target is explicitly excluded [${to.galaxy}:${to.system}:${to.position}]`);
              return false;
            }
            return true;
          });
      this.rate();
      return this.reports;
    });
  }

  private sumValues(obj: any, ...skipFields: string[]): number {
    return Object.keys(obj).reduce((sum: number, key) => {
      if (!skipFields || !skipFields.length || skipFields.every(field => field !== key)) sum += obj[key];
      return sum;
    }, 0)
  }

  rate() {
    this.computeFlight();
    this.computeProductionAndCapacity();
    this.computePlunder();
    this.computeRatingAndSort();
  }

  scan(top: number, threshold: number = 20) {
    this.rate();

    let targetsToScan: ProcessedReport[] = [];
    let count = Math.min(top, this.reports.length);
    for (let i = 0; i < count; ++i) {
      if (this.reports[i].meta.minutesStale! > threshold)
        targetsToScan.push(this.reports[i]);
    }

    targetsToScan.reduce((chain, report) => chain.then(() =>
        Mapper.instance.launch({
          from: report.meta.nearestPlanetId,
          to: report.coordinates,
          fleet: {espionageProbe: 1},
          mission: MissionType.Espionage
        })
    ), Promise.resolve(0));

    return targetsToScan.length;
  }

  launch(top: number) {
    let targetsToLaunch = this.reports.slice(0, top);

    return targetsToLaunch.reduce((chain, report) => chain.then(() => {
          // galaxy may say the target is inactive but fresh report might cancel that
          if (report.playerStatus.toLowerCase().indexOf('i') < 0) {
            let to = report.coordinates;
            console.log(`target is not inactive [${to.galaxy}:${to.system}:${to.position}]`);
            return 0;
          }
          return Mapper.instance.launch({
            from: report.meta.nearestPlanetId,
            to: report.coordinates,
            fleet: {smallCargo: report.meta.requiredTransports},
            mission: MissionType.Attack
          });
        }
    ), Promise.resolve(0));
  }

  private determineCoordinates(): Promise<Coordinates[]> {
    return GalaxyRepository.instance.findInactiveTargets();
  }

  private loadReports(): Promise<ShardedEspionageReport[]> {
    return Promise.all(this.coordinates.map(coordinates => EspionageRepository.instance.loadC(coordinates)))
        .then(reports => reports.filter(x => !!x) as ShardedEspionageReport[]);
  }

  private computeFlight() {
    this.reports.forEach(report => {
      let nearestPlanetId = report.meta.nearestPlanetId = nearestPlanet(report.coordinates);
      let nearestDistance = report.meta.distance = FlightCalculator.distanceC(report.coordinates, PLANETS[nearestPlanetId]);
      report.meta.flightTime = FlightCalculator.flightTime(nearestDistance, FlightCalculator.fleetSpeed({smallCargo: 1}));
    });
  }

  private computeProductionAndCapacity() {
    this.reports.forEach(report => {
      if (report.buildings) {
        let storageLevels: number[] = [report.buildings.metalStorage, report.buildings.crystalStorage, report.buildings.deutStorage];
        report.meta.capacity = storageLevels.map(l => Calculator.DEFAULT.getStorageCapacity(l));

        let mineLevels: number[] = [report.buildings.metalMine, report.buildings.crystalMine, report.buildings.deutMine];
        let unconstrainedProduction = mineLevels.map((l, i) => Calculator.DEFAULT.getProduction(i, l));
        let energyConsumption = mineLevels.map((l, i) => Calculator.DEFAULT.getEnergyConsumption(i, l));
        let requiredEnergy = energyConsumption.reduce((a, b) => a + b);
        let efficiency = Math.min(1, report.resources.energy! / requiredEnergy);

        let mineProduction = unconstrainedProduction.map(x => x * efficiency);
        if (report.researches) {
          let plasmaLevel = report.researches.plasma;
          let bonus = [0.01, 0.0066, 0.0033].map(x => x * plasmaLevel);
          mineProduction = mineProduction.map((x, i) => x + x * bonus[i]);
        }

        report.meta.production = mineProduction.map((x, i) => x + Calculator.DEFAULT.naturalProduction[i]);
      } else {
        report.meta.capacity = Array(3).fill(Infinity);
        report.meta.production = Calculator.DEFAULT.naturalProduction.slice();
      }
    });
  }

  private computePlunder() {
    const now = Date.now();
    this.reports.forEach(report => {
      let time = (now - report.source[0].timestamp.getTime() + report.meta.flightTime! * 1000) / 1000 / 3600;
      let original = [report.resources.metal || 0, report.resources.crystal || 0, report.resources.deut || 0];
      let andProduced = report.meta.production!.map((x, i) => x * time + original[i]);
      let expected = report.meta.expectedResources = andProduced.map((x, i) => Math.max(Math.min(x, report.meta.capacity![i]), original[i]));
      let requiredCapacity = FlightCalculator.capacityFor(expected[0] / 2, expected[1] / 2, expected[2] / 2);
      let nTransports = report.meta.requiredTransports = Math.ceil(requiredCapacity / 7000);
      report.meta.fuelCost = FlightCalculator.fuelConsumption(report.meta.distance!, {smallCargo: nTransports}, report.meta.flightTime);
      let actualCapacity = nTransports * 7000;
      report.meta.expectedPlunder = FlightCalculator.plunderWith(expected[0], expected[1], expected[2], actualCapacity);
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

export const defaultAnalyzer = new Analyzer();
