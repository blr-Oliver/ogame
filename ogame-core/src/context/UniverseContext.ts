export interface UniverseContext {
  readonly maxGalaxy: number;
  readonly maxSystem: number;
  readonly maxPosition: number;
  readonly donutGalaxy: boolean;
  readonly donutSystem: boolean;
  readonly economyFactor: number;
  readonly researchFactor: number;
  readonly peacefulFleetSpeed: number;
  readonly warFleetSpeed: number;
  readonly holdingFleetSpeed: number;
  readonly fleetToDebrisPercent: number;
  readonly defenseToDebrisPercent: number;
  readonly fuelUsagePercent: number;
  readonly deuteriumInDebris: boolean;
  readonly name: string;
}

export function initUniverseContext(data: Partial<UniverseContext>): UniverseContext {
  return Object.defineProperties(new Object(null), {
    maxGalaxy: {
      value: data.maxGalaxy || 9,
      writable: false,
      enumerable: true
    },
    maxSystem: {
      value: data.maxSystem || 499,
      writable: false,
      enumerable: true
    },
    maxPosition: {
      value: data.maxPosition || 16,
      writable: false,
      enumerable: true
    },
    donutGalaxy: {
      value: data.donutGalaxy ?? true,
      writable: false,
      enumerable: true
    },
    donutSystem: {
      value: data.donutSystem ?? true,
      writable: false,
      enumerable: true
    },
    economyFactor: {
      value: data.economyFactor || 1.0,
      writable: false,
      enumerable: true
    },
    researchFactor: {
      value: data.researchFactor || data.economyFactor || 1.0,
      writable: false,
      enumerable: true
    },
    peacefulFleetSpeed: {
      value: data.peacefulFleetSpeed || 1.0,
      writable: false,
      enumerable: true
    },
    warFleetSpeed: {
      value: data.warFleetSpeed || 1.0,
      writable: false,
      enumerable: true
    },
    holdingFleetSpeed: {
      value: data.holdingFleetSpeed || data.warFleetSpeed || 1.0,
      writable: false,
      enumerable: true
    },
    fleetToDebrisPercent: {
      value: data.fleetToDebrisPercent || 30.0,
      writable: false,
      enumerable: true
    },
    defenseToDebrisPercent: {
      value: data.defenseToDebrisPercent || 0.0,
      writable: false,
      enumerable: true
    },
    fuelUsagePercent: {
      value: data.fuelUsagePercent || 100.0,
      writable: false,
      enumerable: true
    },
    deuteriumInDebris: {
      value: data.deuteriumInDebris ?? false,
      writable: false,
      enumerable: true
    },
    name: {
      value: data.name || 'Dorado',
      writable: false,
      enumerable: true
    }
  }) as UniverseContext;
}
