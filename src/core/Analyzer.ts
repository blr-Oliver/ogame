import {Coordinates, MissionType, ShardedEspionageReport} from '../model/types';
import {EspionageRepository} from '../repository/EspionageRepository';
import {GalaxyRepository} from '../repository/GalaxyRepository';
import {Calculator} from './Calculator';
import {FlightCalculator} from './FlightCalculator';
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
  rating?: number;
  minutesStale?: number;
}

export type ProcessedReport = ShardedEspionageReport & { meta: ReportMetaInfo };

export const PLANETS: { [key: number]: Coordinates } = {
  '33638474': {
    galaxy: 1,
    system: 266,
    position: 11
  },
  '33638483': {
    galaxy: 2,
    system: 292,
    position: 13
  },
  '33638501': {
    galaxy: 1,
    system: 26,
    position: 14
  }
};

export class Analyzer {
  coordinates: Coordinates[];
  reports: ProcessedReport[];
  excludedTargets: Coordinates[] = [
    {
      galaxy: 4,
      system: 33,
      position: 8
    }
  ];

  load(): Promise<ProcessedReport[]> {
    const sumValues = (obj: any) => Object.values(obj).reduce((a: number, b: number) => a + b, 0);
    return this.determineCoordinates().then(coordinates => {
      this.coordinates = coordinates;
      return this.loadReports();
    }).then(reports => {
      return this.reports = reports.map(r => ({
        meta: {},
        ...r
      }))
          .filter(report => report.playerStatus.toLowerCase().indexOf('i') >= 0)
          .filter(report =>
              report.defense && sumValues(report.defense) === 0 &&
              report.fleet && sumValues(report.fleet) === 0
          ).filter(report => {
            const to = report.coordinates;
            return !this.excludedTargets.some(c => c.galaxy === to.galaxy && c.system === to.system && c.position === to.position)
          });
    });
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
      if (this.reports[i].meta.minutesStale > threshold)
        targetsToScan.push(this.reports[i]);
    }

    targetsToScan.reduce((chain, report) => chain.then(() =>
        Mapper.instance.launch({
          from: report.meta.nearestPlanetId,
          to: report.coordinates,
          fleet: {espionageProbe: 1},
          mission: MissionType.Espionage
        })
    ), Promise.resolve(null));

    return targetsToScan.length;
  }

  launch(top: number) {
    let targetsToLaunch = this.reports.slice(0, top);

    return targetsToLaunch.reduce((chain, report) => chain.then(() =>
        Mapper.instance.launch({
          from: report.meta.nearestPlanetId,
          to: report.coordinates,
          fleet: {smallCargo: report.meta.requiredTransports},
          mission: MissionType.Attack
        })
    ), Promise.resolve(null));
  }

  private determineCoordinates(): Promise<Coordinates[]> {
    return GalaxyRepository.instance.findInactiveTargets();
  }

  private loadReports(): Promise<ShardedEspionageReport[]> {
    return Promise.all(this.coordinates.map(coordinates => EspionageRepository.instance.loadC(coordinates)));
  }

  private computeFlight() {
    this.reports.forEach(report => {
      let nearestDistance = Infinity;
      let nearestPlanetId: number = null;
      for (let planetId in PLANETS) {
        let distance = FlightCalculator.calculateDistanceC(report.coordinates, PLANETS[planetId]);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPlanetId = +planetId;
        }
      }
      report.meta.nearestPlanetId = nearestPlanetId;
      report.meta.distance = nearestDistance;
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
        let efficiency = Math.min(1, report.resources.energy / requiredEnergy);

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
      let time = (now - report.source[0].timestamp.getTime() + report.meta.flightTime * 1000) / 1000 / 3600;
      let original = [report.resources.metal, report.resources.crystal, report.resources.deut];
      let andProduced = report.meta.production.map((x, i) => x * time + original[i]);
      let expected = report.meta.expectedResources = andProduced.map((x, i) => Math.max(Math.min(x, report.meta.capacity[i]), original[i]));
      let requiredCapacity = FlightCalculator.capacityFor(expected[0] / 2, expected[1] / 2, expected[2] / 2);
      let nTransports = report.meta.requiredTransports = Math.ceil(requiredCapacity / 7000);
      report.meta.fuelCost = FlightCalculator.fuelConsumption(report.meta.distance, {smallCargo: nTransports}, report.meta.flightTime);
      let actualCapacity = nTransports * 7000;
      report.meta.expectedPlunder = FlightCalculator.plunderWith(expected[0], expected[1], expected[2], actualCapacity);
      report.meta.minutesStale = Math.floor((now - report.source[0].timestamp.getTime()) / 1000 / 60);
    });
  }

  private computeRatingAndSort(rate: number[] = [0.5, 1.2, 1.5]) {
    this.reports.forEach(report => {
      let value = report.meta.expectedPlunder.reduce((total, value, i) => total + value * rate[i], 0);
      report.meta.rating = (value - report.meta.fuelCost * rate[2]) / report.meta.flightTime;
    });

    this.reports.sort((a, b) => b.meta.rating - a.meta.rating);
  }
}

export const defaultAnalyzer = new Analyzer();

/*

select
	s.galaxy, s.system, s.position, count(e.id) as reports
from
	galaxy_report_slot s
left join
	espionage_report e
on
	s.galaxy = e.galaxy and s.system = e.system and s.position = e.position
where
	(s.player_status like '%i%' or s.player_status like '%I%') and s.player_status not like '%РО%'
group by
	s.galaxy, s.system, s.position;

 */
