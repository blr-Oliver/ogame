export class Calculator {
  static readonly BUILDING_COUNT = 4;
  static readonly RESOURCE_COUNT = 3;
  private static readonly ZERO_COST: number[] = [...Array(Calculator.RESOURCE_COUNT)].fill(0);

  static readonly DEFAULT: Calculator = new Calculator(
      3.0,
      [
        [60, 15, 0],
        [48, 24, 0],
        [225, 75, 0],
        [75, 30, 0]
      ],
      [1.5, 1.6, 1.5, 1.5],
      [30, 15, 0],
      [30, 20, 10 * (1.36 - 0.004 * 0)],
      20,
      [10, 10, 20]
  );


  readonly economySpeed: number;
  readonly baseCost: number[/*building*/][/*resource*/];
  readonly costGrowth: number[/*building*/];
  readonly naturalProduction: number[/*resource*/];
  readonly baseProduction: number[/*resource*/];
  readonly baseEnergyProduction: number;
  readonly baseEnergyConsumption: number[/*resource*/];

  private readonly costCache: number[/*building*/][/*level*/][/*resource*/];
  private readonly accumulativeCostCache: number[/*building*/][/*level*/][/*delta*/][/*resource*/];
  private readonly productionCache: number[/*resource*/][/*level*/];
  private readonly energyConsumptionCache: number[/*resource*/][/*level*/];
  private readonly energyProductionCache: number[];
  private readonly storageCache: number[];

  constructor(economySpeed: number, baseCost: number[][], costGrowth: number[], naturalProduction: number[], baseProduction: number[], baseEnergyProduction: number, baseEnergyConsumption: number[]) {
    this.economySpeed = economySpeed;
    this.baseCost = baseCost;
    this.costGrowth = costGrowth;
    this.naturalProduction = naturalProduction.map(x => x * economySpeed);
    this.baseProduction = baseProduction;
    this.baseEnergyProduction = baseEnergyProduction;
    this.baseEnergyConsumption = baseEnergyConsumption;

    this.costCache = Array(Calculator.BUILDING_COUNT);
    this.accumulativeCostCache = Array(Calculator.BUILDING_COUNT);
    this.productionCache = Array(Calculator.RESOURCE_COUNT);
    this.energyConsumptionCache = Array(Calculator.RESOURCE_COUNT);
    this.energyProductionCache = [];
    this.storageCache = [];
    for (let i = 0; i < Calculator.BUILDING_COUNT; ++i) {
      this.costCache[i] = [];
      this.accumulativeCostCache[i] = [];
    }
    for (let i = 0; i < Calculator.RESOURCE_COUNT; ++i) {
      this.productionCache[i] = [];
      this.energyConsumptionCache[i] = [];
    }
  }

  getCost(building: number, level: number): number[] {
    if (level <= 0) return Calculator.ZERO_COST;
    return this.costCache[building][level - 1] || (this.costCache[building][level - 1] = this.computeCost(building, level));
  }

  getAccumulativeCost(building: number, from: number, to: number): number[] {
    const delta = to - from;
    if (delta <= 0) return Calculator.ZERO_COST;
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
  getEnergyConsumption(resource: number, level: number): number {
    if (level <= 0) return 0;
    return this.energyConsumptionCache[resource][level - 1] || (this.energyConsumptionCache[resource][level - 1] = this.computeEnergyConsumption(resource, level));
  }
  getEnergyProduction(level: number): number {
    if (level <= 0) return 0;
    return this.energyProductionCache[level - 1] || (this.energyProductionCache[level - 1] = this.computeEnergyProduction(level));
  }
  getStorageCapacity(level: number) {
    return this.storageCache[level] || (this.storageCache[level] = 5000 * Math.floor(2.5 * Math.exp(20 * level / 33)));
  }

  private computeCost(building: number, level: number): number[] {
    const multiplier = Math.pow(this.costGrowth[building], level - 1);
    return this.baseCost[building].map(x => Math.floor(x * multiplier));
  }
  private computeAccumulativeCost(building: number, from: number, delta: number, cache: number[][]): number[] {
    let lastDelta = cache.length;
    let accumulated = lastDelta ? cache[lastDelta - 1] : this.getCost(building, from);
    while (lastDelta < delta) {
      ++lastDelta;
      let next = this.getCost(building, from + lastDelta);
      accumulated = accumulated.slice();
      for (let i = 0; i < Calculator.RESOURCE_COUNT; ++i)
        accumulated[i] += next[i];
      cache[lastDelta - 1] = accumulated;
    }
    return accumulated;
  }
  private computeProduction(resource: number, level: number): number {
    return level * Math.pow(1.1, level) * this.baseProduction[resource] * this.economySpeed;
  }
  /* Energy consumption should be rounded UP but only after applying throttling level */
  private computeEnergyConsumption(resource: number, level: number): number {
    return level * Math.pow(1.1, level) * this.baseEnergyConsumption[resource];
  }
  /* Because throttling on energy production is always 1.0, rounding is applied right here */
  private computeEnergyProduction(level: number): number {
    return Math.floor(level * Math.pow(1.1, level) * this.baseEnergyProduction);
  }
}
