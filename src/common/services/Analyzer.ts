import {processAll} from '../common';
import {PlayerContext} from '../core/PlayerContext';
import {ShardedEspionageReport} from '../report-types';
import {EspionageRepository, GalaxyRepository} from '../repository-types';
import {Coordinates, MissionType, Researches, SpaceBody} from '../types';
import {Mapper} from './Mapper';
import {ReportProcessor} from './ReportProcessor';

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
  age?: number;
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
              private processor: ReportProcessor) {
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
    this.reports.forEach(report => this.processor.processReport(report, researches, bodies, [0.5, 1.2, 1.5]));
    this.reports.sort((a, b) => b.meta.rating! - a.meta.rating!);
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
}
