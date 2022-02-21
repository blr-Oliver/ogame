import {getNearest} from '../common';
import {CostCalculator} from '../core/calculator/CostCalculator';
import {FlightCalculator} from '../core/calculator/FlightCalculator';
import {UniverseContext} from '../core/UniverseContext';
import {ShardedEspionageReport} from '../report-types';
import {Buildings, Coordinates, Researches, Resources, SpaceBody} from '../types';
import {ProcessedReport, ReportMetaInfo} from './Analyzer';

export class ReportProcessor {
  constructor(
      private readonly universe: UniverseContext,
      private readonly flightCalculator: FlightCalculator,
      private readonly costCalculator: CostCalculator) {
  }

  processReport(report: ShardedEspionageReport | ProcessedReport,
                researches: Researches,
                bodies: SpaceBody[],
                rate: number[]): ProcessedReport {
    const to: Coordinates = report.coordinates;
    const nearestBody = getNearest(bodies, to, this.flightCalculator);
    if (report.infoLevel === -1) {
      let dummy = report as ProcessedReport, meta: ReportMetaInfo = dummy.meta = {};
      meta.nearestPlanetId = nearestBody.id;
      meta.distance = this.flightCalculator.distanceC(to, nearestBody.coordinates);
      return dummy;
    }

    let meta: ReportMetaInfo = {}, result = report as ProcessedReport;
    const reportAge = Date.now() - report.source[0].timestamp.getTime();
    result.meta = meta;

    meta.nearestPlanetId = nearestBody.id;
    this.computeFlightTime(meta, to, nearestBody, researches);

    if (report.buildings) {
      meta.capacity = this.computeStorageCapacity(report.buildings);
      meta.production = this.computeProduction(report.resources, report.buildings, report.researches);
    } else {
      meta.capacity = Array(3).fill(Infinity);
      meta.production = this.costCalculator.data.naturalProduction.slice();
    }
    meta.production = meta.production.map(x => x * this.universe.economyFactor);

    this.computePlunder(meta, report.resources, researches, reportAge);
    this.computeRating(meta, rate);

    return result;
  }

  private computeFlightTime(meta: ReportMetaInfo, to: Coordinates, nearestBody: SpaceBody, researches: Researches) {
    let nearestDistance = meta.distance = this.flightCalculator.distanceC(to, nearestBody.coordinates);
    meta.flightTime = this.flightCalculator.flightTime(nearestDistance, this.flightCalculator.fleetSpeed({smallCargo: 1}, researches));
  }

  private computeStorageCapacity(buildings: Buildings): number[] {
    let storageLevels: number[] = [buildings.metalStorage || 0, buildings.crystalStorage || 0, buildings.deutStorage || 0];
    return storageLevels.map(l => this.costCalculator.getStorageCapacity(l));
  }

  private computeProduction(resources: Resources, buildings: Buildings, researches?: Researches) {
    let mineLevels: number[] = [(buildings)!.metalMine || 0, (buildings)!.crystalMine || 0, (buildings)!.deutMine || 0];
    let unconstrainedProduction = mineLevels.map((l, i) => this.costCalculator.getProduction(i, l));
    let energyConsumption = mineLevels.map((l, i) => this.costCalculator.getEnergyConsumption(i, l));
    let requiredEnergy = energyConsumption.reduce((a, b) => a + b);
    let efficiency = Math.min(1, resources.energy! / requiredEnergy);

    let mineProduction = unconstrainedProduction.map(x => x * efficiency);
    if (researches) {
      let plasmaLevel = researches.plasma || 0;
      let bonus = [0.01, 0.0066, 0.0033].map(x => x * plasmaLevel);
      mineProduction = mineProduction.map((x, i) => x + x * bonus[i]);
    }
    return mineProduction.map((x, i) => x + this.costCalculator.data.naturalProduction[i]);
  }

  private computeExpectedResources(meta: ReportMetaInfo, resources: Resources, reportAge: number) {
    let miningTime = (reportAge + meta.flightTime! * 1000) / 1000 / 3600;
    let original = [resources.metal || 0, resources.crystal || 0, resources.deuterium || 0];
    let andProduced = meta.production!.map((x, i) => x * miningTime + original[i]);
    return meta.expectedResources = andProduced.map((x, i) => Math.max(Math.min(x, meta.capacity![i]), original[i]));
  }

  private computePlunder(meta: ReportMetaInfo, resources: Resources, researches: Researches, reportAge: number) {
    let expected = this.computeExpectedResources(meta, resources, reportAge);
    let requiredCapacity = this.flightCalculator.capacityFor(expected[0] / 2, expected[1] / 2, expected[2] / 2);
    const cargoCapacity = 5000 * (1 + (researches.hyperspace || 0) * 0.05);
    let nTransports = meta.requiredTransports = Math.ceil(requiredCapacity / cargoCapacity);
    meta.fuelCost = this.flightCalculator.fuelConsumption(meta.distance!, {smallCargo: nTransports}, researches, meta.flightTime!);
    let actualCapacity = nTransports * cargoCapacity;
    meta.expectedPlunder = this.flightCalculator.plunderWith(expected[0], expected[1], expected[2], actualCapacity);
    meta.loadRatio = meta.expectedPlunder.reduce((a, b) => a + b, 0) / actualCapacity;
    meta.age = reportAge / 1000;
  }

  private computeRating(meta: ReportMetaInfo, rate: number[]) {
    meta.value = meta.expectedPlunder!.reduce((value, x, i) => value + x * rate[i], 0);
    meta.value -= meta.fuelCost! * rate[2];
    meta.rating = meta.value / meta.flightTime!;
  }
}
