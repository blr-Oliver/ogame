export interface CostCalculatorData {
  readonly metalBonus: number[];
  readonly crystalBonus: number[];
  readonly averageTemperature: number[];
  readonly defaultTemperature: number;
  readonly temperatureVariance: number;
  readonly deuteriumProductionBase: number;
  readonly deuteriumProductionSlope: number;
  readonly baseCost: number[/*building*/][/*resource*/];
  readonly costGrowth: number[/*building*/];
  readonly productionGrowth: number[/*building*/];
  readonly naturalProduction: number[/*resource*/];
  readonly baseProduction: number[/*resource*/];
  readonly baseEnergyProduction: number;
  readonly baseEnergyConsumption: number[/*resource*/];
}

export interface CostCalculator {
  readonly data: CostCalculatorData;
  getMetalMultiplier(position: number): number;
  getCrystalMultiplier(position: number): number;
  getDeuteriumMultiplier(temperature: number): number;
  getProductionMultiplier(position: number, temperature?: number): number[];
  getCost(building: number, level: number): number[];
  getAccumulativeCost(building: number, from: number, to: number): number[];
  getProduction(resource: number, level: number): number;
  getEnergyConsumption(mine: number, level: number): number;
  getEnergyProduction(level: number): number;
  getStorageCapacity(level: number): number;
  computeCost(building: number, level: number): number[];
  computeAccumulativeCost(building: number, from: number, delta: number, cache: number[][]): number[];
  computeProduction(resource: number, level: number): number;
  computeEnergyConsumption(resource: number, level: number): number;
  computeEnergyProduction(level: number): number;
}

export const DEFAULT_DATA: CostCalculatorData = {
  metalBonus: [0, 0, 0, 0, 0, 0, 17, 23, 35, 23, 17, 0, 0, 0, 0, 0, 0, 0],
  crystalBonus: [0, 40, 30, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  averageTemperature: [0, 220, 170, 120, 70, 60, 50, 40, 30, 20, 10, 0, -10, -50, -90, -130],
  defaultTemperature: 30,
  temperatureVariance: 20,
  deuteriumProductionBase: 0.68,
  deuteriumProductionSlope: -0.002,
  baseCost: [
    [60, 15, 0],
    [48, 24, 0],
    [225, 75, 0],
    [75, 30, 0]
  ],
  costGrowth: [1.5, 1.6, 1.5, 1.5],
  productionGrowth: [1.1, 1.1, 1.1, 1.1],
  naturalProduction: [30, 15, 0],
  baseProduction: [30, 20, 10],
  baseEnergyProduction: 20,
  baseEnergyConsumption: [10, 10, 20]
}

export class CachingCostCalculator implements CostCalculator {
  static readonly BUILDING_COUNT = 4;
  static readonly RESOURCE_COUNT = 3;
  private static readonly ZERO_COST: number[] = [...Array(CachingCostCalculator.RESOURCE_COUNT)].fill(0);

  static readonly DEFAULT: CachingCostCalculator = new CachingCostCalculator(DEFAULT_DATA);

  readonly data: CostCalculatorData;

  private readonly costCache: number[/*building*/][/*level*/][/*resource*/];
  private readonly accumulativeCostCache: number[/*building*/][/*level*/][/*delta*/][/*resource*/];
  private readonly productionCache: number[/*resource*/][/*level*/];
  private readonly energyConsumptionCache: number[/*resource*/][/*level*/];
  private readonly energyProductionCache: number[];
  private readonly storageCache: number[];

  constructor(data: CostCalculatorData = DEFAULT_DATA) {
    this.data = data;

    this.costCache = Array(CachingCostCalculator.BUILDING_COUNT);
    this.accumulativeCostCache = Array(CachingCostCalculator.BUILDING_COUNT);
    this.productionCache = Array(CachingCostCalculator.RESOURCE_COUNT);
    this.energyConsumptionCache = Array(CachingCostCalculator.RESOURCE_COUNT);
    this.energyProductionCache = [];
    this.storageCache = [];
    for (let i = 0; i < CachingCostCalculator.BUILDING_COUNT; ++i) {
      this.costCache[i] = [];
      this.accumulativeCostCache[i] = [];
    }
    for (let i = 0; i < CachingCostCalculator.RESOURCE_COUNT; ++i) {
      this.productionCache[i] = [];
      this.energyConsumptionCache[i] = [];
    }
  }

  getMetalMultiplier(position: number): number {
    return this.data.metalBonus[position] * 0.01 + 1.0;
  }

  getCrystalMultiplier(position: number): number {
    return this.data.crystalBonus[position] * 0.01 + 1.0;
  }
  getDeuteriumMultiplier(temperature: number): number {
    return this.data.deuteriumProductionBase + this.data.deuteriumProductionSlope * temperature;
  }

  getProductionMultiplier(position: number, temperature: number = this.data.defaultTemperature): number[] {
    return [
      this.getMetalMultiplier(position),
      this.getCrystalMultiplier(position),
      this.getDeuteriumMultiplier(temperature)
    ];
  }

  getCost(building: number, level: number): number[] {
    if (level <= 0) return CachingCostCalculator.ZERO_COST;
    return this.costCache[building][level - 1] || (this.costCache[building][level - 1] = this.computeCost(building, level));
  }

  getAccumulativeCost(building: number, from: number, to: number): number[] {
    const delta = to - from;
    if (delta <= 0) return CachingCostCalculator.ZERO_COST;
    let buildingCache: number[][][] = this.accumulativeCostCache[building];
    let fromCache: number[][];
    if (!(fromCache = buildingCache[from])) fromCache = buildingCache[from] = [];
    return fromCache[delta - 1] || (fromCache[delta - 1] = this.computeAccumulativeCost(building, from, delta, fromCache));
  }

  getProduction(resource: number, level: number): number {
    if (level <= 0) return 0;
    return this.productionCache[resource][level - 1] || (this.productionCache[resource][level - 1] = this.computeProduction(resource, level));
  }
  /* Energy consumption should be rounded UP but only after applying throttling level */
  getEnergyConsumption(mine: number, level: number): number {
    if (level <= 0) return 0;
    return this.energyConsumptionCache[mine][level - 1] || (this.energyConsumptionCache[mine][level - 1] = this.computeEnergyConsumption(mine, level));
  }
  getEnergyProduction(level: number): number {
    if (level <= 0) return 0;
    return this.energyProductionCache[level - 1] || (this.energyProductionCache[level - 1] = this.computeEnergyProduction(level));
  }
  getStorageCapacity(level: number) {
    return this.storageCache[level] || (this.storageCache[level] = 5000 * Math.floor(2.5 * Math.exp(20 * level / 33)));
  }

  computeCost(building: number, level: number): number[] {
    const multiplier = Math.pow(this.data.costGrowth[building], level - 1);
    return this.data.baseCost[building].map(x => Math.floor(x * multiplier));
  }
  computeAccumulativeCost(building: number, from: number, delta: number, cache: number[][]): number[] {
    let lastDelta = cache.length;
    let accumulated = lastDelta ? cache[lastDelta - 1] : this.getCost(building, from);
    while (lastDelta < delta) {
      ++lastDelta;
      let next = this.getCost(building, from + lastDelta);
      accumulated = accumulated.slice();
      for (let i = 0; i < CachingCostCalculator.RESOURCE_COUNT; ++i)
        accumulated[i] += next[i];
      cache[lastDelta - 1] = accumulated;
    }
    return accumulated;
  }
  computeProduction(resource: number, level: number): number {
    return level * Math.pow(this.data.productionGrowth[resource], level) * this.data.baseProduction[resource];
  }
  /* Energy consumption should be rounded UP but only after applying throttling level */
  computeEnergyConsumption(resource: number, level: number): number {
    return level * Math.pow(this.data.productionGrowth[resource], level) * this.data.baseEnergyConsumption[resource];
  }
  /* Because throttling on energy production is always 1.0, rounding is applied right here */
  computeEnergyProduction(level: number): number {
    return Math.floor(level * Math.pow(this.data.productionGrowth[3], level) * this.data.baseEnergyProduction);
  }
}
