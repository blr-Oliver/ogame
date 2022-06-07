import {getNearest} from '../common';
import {CostCalculator} from '../core/calculator/CostCalculator';
import {FlightCalculator} from '../core/calculator/FlightCalculator';
import {UniverseContext} from '../core/UniverseContext';
import {EspionageReport, ShardedEspionageReport} from '../report-types';
import {Coordinates, CoordinateType, FleetPartial, Mission, MissionType, Researches, sameCoordinates, SpaceBody} from '../types';

export type Triplet = [number, number, number];

export interface AnalyzerSettings {
  timeShift: number;    // ms
  rating: Triplet;
  maxReportAge: number; // ms
  minRaid: number;      // #transports
  desertedPlanets: Coordinates[];
  ignoreBuildingProduction: boolean;
  maxDistance: number;
}

export const DEFAULT_SETTINGS: AnalyzerSettings = {
  timeShift: 1000 * 3600 * 3, // ms
  rating: [1, 3, 4],
  maxReportAge: 1000 * 3600 * 0.5, // ms
  minRaid: 30, // #transports
  desertedPlanets: [],
  ignoreBuildingProduction: false,
  maxDistance: 40000 // = 2 galaxy
}

export interface SuggestionRequest {
  unexploredTargets: Coordinates[];
  reports: ShardedEspionageReport[];
  bodies: SpaceBody[];
  researches: Researches;
  fleet: { [bodyId: number]: FleetPartial };
  maxMissions: number;
}

interface Production {
  hourly: Triplet;
  limit: Triplet;
}

interface ProcessingItem {
  report: ShardedEspionageReport;
  age: number; // ms
  nearestBody: SpaceBody;
  distance: number;
  flightTime: number; // seconds
  production: Production;
  expectedResources: Triplet;
  maximumPlunder: Triplet;
  transports: number;
  fuel: number;
  ratedValue: number;
  efficiency: number;
  limitOrigins: SpaceBody[];
}

function createProcessingItem(report: ShardedEspionageReport): ProcessingItem {
  return {report} as ProcessingItem;
}

export class RaidReportAnalyzer {
  constructor(
      private universe: UniverseContext,
      private flightCalc: FlightCalculator,
      private costCalc: CostCalculator,
      public readonly settings: AnalyzerSettings = DEFAULT_SETTINGS
  ) {
  }

  /*
    // find nearest body for each target
    // compute flightTimes to each target from nearest body
    // compute minimal resource available considering minimum flight time
    // compute minimal transport count
    // compute raid value using rating and then efficiency per unit of time
    // sort reports based on rating
    // pick top reports by rating limited by maxMissions
    // check if any of them are old - commit spy missions
    // pick any rest of targets fresh and valuable enough
    // check if this matches lower bound for raid
    // find closest origins having enough transports to plunder
    // if nearestBody and closest good origin don't match - recalculate for new origin/flight time
   */
  suggestMissions(request: SuggestionRequest): Mission[] {
    if (request.maxMissions <= 0) return [];
    const items = request.reports.map(report => createProcessingItem(report));
    const now = Date.now();
    items.forEach(item => {
      this.computeUnconditional(request, item, now);
      this.computeConditional(request, item);
    });

    this.sortByEfficiency(items);

    const unexploredTargets: Coordinates[] = request.unexploredTargets.slice(0, request.maxMissions);
    // prioritize unexplored targets
    const missions: Mission[] = unexploredTargets.map(target => {
      const origin = getNearest(request.bodies, target, this.flightCalc);
      return {from: origin.id, to: target, fleet: {espionageProbe: 1}, mission: MissionType.Espionage};
    });
    while (items.length > 0 && missions.length < request.maxMissions) {
      const candidate = items.pop()!;
      if (!this.isClean(candidate.report)) { // maybe it's already clean?
        // enough time passed
        if (candidate.age >= 1000 * 3600 * 24 &&
            // and it's safe to rescan
            (candidate.report.counterEspionage === 0 || candidate.report.infoLevel > 0 && this.sumFields(candidate.report.fleet!) === 0)) {
          missions.push({from: candidate!.nearestBody.id, to: candidate!.report.coordinates, fleet: {espionageProbe: 1}, mission: MissionType.Espionage});
        }
        continue;
      }
      if (candidate.distance > this.settings.maxDistance) {
        this.excludeOriginAndReattempt(candidate, request, items);
        continue;
      }
      if (candidate.age > this.settings.maxDistance || candidate.age >= candidate.flightTime * 1000) {
        missions.push({from: candidate!.nearestBody.id, to: candidate!.report.coordinates, fleet: {espionageProbe: 1}, mission: MissionType.Espionage});
      } else {
        const transports = candidate.transports;
        if (transports >= this.settings.minRaid) {
          const from = candidate.nearestBody.id;
          if ((request.fleet[from]?.smallCargo || 0) >= transports) {
            request.fleet[from]!.smallCargo! -= transports;
            missions.push({from: candidate.nearestBody.id, to: candidate.report.coordinates, fleet: {smallCargo: transports}, mission: MissionType.Attack});
          } else if ((candidate.limitOrigins || request.bodies).length > 1) {
            this.excludeOriginAndReattempt(candidate, request, items);
          }
        }
      }
    }

    return missions;
  }

  private excludeOriginAndReattempt(candidate: ProcessingItem, request: SuggestionRequest, items: ProcessingItem[]) {
    if (!candidate.limitOrigins) candidate.limitOrigins = request.bodies.slice();
    candidate.limitOrigins.splice(candidate.limitOrigins.indexOf(candidate.nearestBody), 1);
    if (candidate.limitOrigins.length) {
      this.findNearestBody(request, candidate);
      this.computeConditional(request, candidate);
      items.push(candidate);
      this.sortByEfficiency(items);
    }
  }

  private computeUnconditional(request: SuggestionRequest, item: ProcessingItem, now: number) {
    this.computeAge(request, item, now);
    this.computeProduction(request, item, item.report);
    this.findNearestBody(request, item);
  }

  private computeConditional(request: SuggestionRequest, item: ProcessingItem) {
    this.computeFlightTime(request, item);
    this.computeExpectedResources(request, item);
    this.computePlunder(request, item);
    this.computeTransports(request, item);
    this.computeRating(request, item);
  }

  private sortByEfficiency(items: ProcessingItem[]) {
    items.sort((a, b) => a.efficiency - b.efficiency);
  }

  private computeAge(request: SuggestionRequest, item: ProcessingItem, now: number) {
    item.age = Math.max(0, now - item.report.source[0].timestamp.getTime() - this.settings.timeShift);
  }

  private findNearestBody(request: SuggestionRequest, item: ProcessingItem) {
    item.nearestBody = getNearest(item.limitOrigins || request.bodies, item.report.coordinates, this.flightCalc);
  }

  private computeFlightTime(request: SuggestionRequest, item: ProcessingItem) {
    const maxSpeed = this.flightCalc.fleetSpeed({smallCargo: 1}, request.researches);
    item.distance = this.flightCalc.distanceC(item.report.coordinates, item.nearestBody.coordinates);
    item.flightTime = this.flightCalc.flightTime(item.distance, maxSpeed, 10, MissionType.Attack);
  }

  private computeProduction(request: SuggestionRequest, item: ProcessingItem, report: ShardedEspionageReport) {
    const ignoreProduction = this.settings.ignoreBuildingProduction ||
        this.settings.desertedPlanets.some(deserted => sameCoordinates(deserted, report.coordinates));
    item.production = this.calculateProduction(report, ignoreProduction);
  }

  private calculateProduction(report: EspionageReport, ignoreMines: boolean = false) {
    const buildings = report.buildings;
    const coordinates = report.coordinates;
    const isMoon = coordinates.type === CoordinateType.Moon;
    const result: Production = {
      hourly: [0, 0, 0],
      limit: [Infinity, Infinity, Infinity]
    };

    if (!isMoon) {
      const position = coordinates.position;
      const positionMultiplier = this.costCalc.getProductionMultiplier(position);
      const baseNaturalProduction = this.costCalc.data.naturalProduction;
      const naturalProduction = baseNaturalProduction.map((x, i) => x * positionMultiplier[i] * this.universe.economyFactor);
      if (buildings) {
        const storageLevels = [buildings.metalStorage || 0, buildings.crystalStorage || 0, buildings.deutStorage || 0];
        result.limit = storageLevels.map(level => this.costCalc.getStorageCapacity(level)) as Triplet;
      }
      if (buildings && !ignoreMines) {
        const mineLevels = [buildings.metalMine || 0, buildings.crystalMine || 0, buildings.deutMine || 0];
        const plasmaMultiplier = this.plasmaMultiplier(report.researches?.plasma);
        const classMultiplier = 1 + (report.playerClass === 'collector' ? 0.25 : 0) + (report.allianceClass === 'trader' ? 0.05 : 0);
        const mineProduction = mineLevels.map((level, i) => this.costCalc.getProduction(i, level)
            * positionMultiplier[i] * plasmaMultiplier[i] * classMultiplier * this.universe.economyFactor);
        const energyNeeded = mineLevels.reduce((sum, level, i) => sum + this.costCalc.getEnergyConsumption(i, level), 0);
        const energyAvailable = report.resources.energy ?? energyNeeded;
        const productionFactor = Math.min(1, energyNeeded ? energyAvailable / energyNeeded : 0);
        result.hourly = mineProduction.map((x, i) => x * productionFactor + naturalProduction[i]) as Triplet;
      } else {
        result.hourly = naturalProduction as Triplet;
      }
    }
    return result;
  }

  private computeExpectedResources(request: SuggestionRequest, item: ProcessingItem) {
    let miningTime = (item.age + item.flightTime * 1000) / 1000 / 3600;
    let resources: Triplet = [item.report.resources.metal || 0, item.report.resources.crystal || 0, item.report.resources.deuterium || 0];
    item.expectedResources = resources.map((r, i) => Math.floor(
        Math.max(r, Math.min(r + item.production.hourly[i] * miningTime, item.production.limit[i]))
    )) as Triplet;
  }

  private computePlunder(request: SuggestionRequest, item: ProcessingItem) {
    const loot = (item.report.loot || 75) * 0.01;
    item.maximumPlunder = item.expectedResources.map(r => Math.floor(r * loot)) as Triplet;
  }

  private computeTransports(request: SuggestionRequest, item: ProcessingItem) {
    const capacity = this.flightCalc.capacityFor(item.maximumPlunder[0], item.maximumPlunder[1], item.maximumPlunder[2]);
    const transportCapacity = 5000 * (1 + (request.researches.hyperspace || 0) * 0.05);
    item.transports = Math.ceil(capacity / transportCapacity);
    /*
    const actualPlunder = this.flightCalc.plunderWith(
        item.expectedResources[0], item.expectedResources[1], item.expectedResources[2], capacity, (item.report.loot || 75) * 0.01);
    const difference = actualPlunder.reduce((sum, r, i) => sum += Math.abs(r - item.maximumPlunder[i]), 0);
     */
    item.fuel = this.flightCalc.fuelConsumption(item.distance, {smallCargo: item.transports},
        request.researches, item.flightTime, 0, MissionType.Attack);
  }

  private computeRating(request: SuggestionRequest, item: ProcessingItem) {
    item.ratedValue = item.maximumPlunder.reduce((sum, r, i) => sum + r * this.settings.rating[i], 0);
    item.ratedValue -= this.settings.rating[2] * item.fuel;
    item.efficiency = item.ratedValue / item.flightTime;
  }

  private plasmaMultiplier(level: number = 0): Triplet {
    return [0.01, 0.0066, 0.0033].map(x => 1 + level * x) as Triplet;
  }

  private isClean(report: ShardedEspionageReport): boolean {
    if (report.infoLevel < 2) return false;
    if (this.sumFields(report.fleet!) !== 0) return false;
    if (this.sumFields(report.defense!) !== (report.defense!.antiBallistic || 0) + (report.defense!.interplanetary || 0)) return false;
    return true;
  }

  private sumFields(data: { [key: string]: number }): number {
    let sum = 0;
    for (let key in data)
      sum += data[key];
    return sum;
  }
}
