import {Launcher} from 'ogame-api-facade';
import {Coordinates, CoordinateType, Fleet, FleetPartial, Mission, MissionType, ShipType, SpaceBody} from 'ogame-core/types/core';
import {PlayerContext} from '../../uniplatform/core/PlayerContext';

export type ShipCompositionRule = {
  type: 'fixed' | 'varying';
  min: number;
  max: number;
  preferred: number;
  reserved?: number;
}

export type FleetCompositionRule = {
  [key in ShipType]?: ShipCompositionRule;
}

export interface ExpeditorSettings {
  holdTime?: number,
  reservedFleet: FleetPartial,
  rules: FleetCompositionRule[];
}

export class Expeditor {
  constructor(private readonly launcher: Launcher,
              private readonly player: PlayerContext,
              public settings: ExpeditorSettings) {
  }

  async start(galaxy: number, ...missionsPerRule: number[]): Promise<unknown[]> {
    if (missionsPerRule.length !== this.settings.rules.length)
      throw new Error(`Expeditor: expected ${this.settings.rules.length} mission counts, got ${missionsPerRule}`);
    if (missionsPerRule.some(x => x < 0))
      throw new Error(`Expeditor: mission count must be positive`);
    const origin = await this.getOrigin(galaxy);
    const fleet = await this.player.getFleet(origin.id);
    const compositions = this.calculateCombinedCompositions(fleet, missionsPerRule);
    const missions = this.prepareMissions(origin, compositions, missionsPerRule);
    return Promise.all(missions.map(mission => this.launcher.launch(mission)));
  }

  private prepareMissions(origin: SpaceBody, compositions: FleetPartial[], missionsPerRule: number[]): Mission[] {
    const holdTime = this.settings.holdTime || 1;
    const to: Coordinates = {
      galaxy: origin.coordinates.galaxy,
      system: origin.coordinates.system,
      position: 16
    }
    return compositions.flatMap((fleet, i) => {
      const mission: Mission = {
        mission: MissionType.Expedition,
        from: origin.id,
        to,
        holdTime,
        fleet
      };
      return Array(missionsPerRule[i]).fill(mission);
    });
  }
  private async getOrigin(galaxy: number): Promise<SpaceBody> {
    let bodies = await this.player.getBodies();
    let origin = bodies.find(body => body.coordinates.galaxy === galaxy && body.coordinates.type == CoordinateType.Moon);
    if (!origin)
      throw new Error(`Expeditor: origin from galaxy ${galaxy} not found`);
    return origin;
  }

  private calculateCombinedCompositions(fleet: Fleet, missionsPerRule: number[]): FleetPartial[] {
    for (let key in this.settings.reservedFleet) {
      const ship = key as ShipType;
      fleet[ship] = Math.max(0, fleet[ship] - this.settings.reservedFleet[ship]!);
    }
    const preferredComposition: FleetPartial[] = this.settings.rules.map((rule, i) =>
        this.calculateComposition(rule, fleet, missionsPerRule[i], true));
    const preferredTotalPerRule: FleetPartial[] = [];
    const usedShips: FleetPartial = {};
    preferredComposition.forEach((ruleFleet, i) => {
      const multiplier = missionsPerRule[i];
      const preferredRuleTotal: FleetPartial = preferredTotalPerRule[i] = {};
      for (let key in ruleFleet) {
        const shipType = key as ShipType;
        usedShips[shipType] = 0;
        preferredRuleTotal[shipType] = ruleFleet[shipType]! * multiplier;
      }
    });
    const distributedFleet: FleetPartial[] = this.distributeFleet(preferredTotalPerRule, fleet, Object.keys(usedShips) as ShipType[]);
    return distributedFleet.map((fleet, i) =>
        this.calculateComposition(this.settings.rules[i], fleet, missionsPerRule[i], false));
  }

  private distributeFleet(perRule: FleetPartial[], actual: FleetPartial, usedShips: ShipType[]): FleetPartial[] {
    const result: FleetPartial[] = perRule.map(_ => ({}));
    for (let shipType of usedShips) {
      const amounts = this.distributeProportionally(perRule.map(fleet => fleet[shipType] || 0), actual[shipType] || 0);
      amounts.forEach((x, i) => result[i][shipType] = x);
    }
    return result;
  }

  private distributeProportionally(perRule: number[], actual: number): number[] {
    const total = perRule.reduce((a, b) => a + b, 0);
    const multiplier = actual / total;
    return perRule.map(x => x * multiplier);
  }

  private calculateComposition(rule: FleetCompositionRule, fleet: FleetPartial, n: number, preferred: boolean): FleetPartial {
    const result: FleetPartial = {};
    let base = Infinity;
    for (let key in rule) {
      const shipType = key as ShipType;
      const shipRule = rule[shipType]!;
      let available = fleet[shipType] || 0;
      if (shipRule.type === 'varying') {
        const multiplier = preferred ? shipRule.preferred : shipRule.min;
        base = Math.max(0, Math.min(available / n / multiplier, base));
      }
    }
    for (let key in rule) {
      const shipType = key as ShipType;
      const shipRule = rule[shipType]!;
      let available = fleet[shipType] || 0;
      if (shipRule.type === 'fixed') {
        let shipCount = Math.min(Math.floor(available / n), shipRule.preferred); // shipRule.max
        if (shipCount < shipRule.min) throw new Error(`Expeditor: not enough ships of type ${shipType}`);
        result[shipType] = shipCount;
      } else if (shipRule.type === 'varying') {
        const multiplier = preferred ? shipRule.preferred : shipRule.max;
        result[shipType] = Math.max(0, Math.floor(Math.min(available / n, base * multiplier)));
      }
    }
    return result;
  }
}
