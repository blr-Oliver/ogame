import {processAll} from '../common';
import {PlayerContext} from '../core/PlayerContext';
import {Coordinates, Fleet, FleetPartial, MissionType, ShipType, SpaceBody} from '../types';
import {Launcher} from './Mapper';

export type ShipCompositionRule = {
  type: 'fixed' | 'varying';
  min: number;
  max: number;
  reserved?: number;
}

export type FleetCompositionRule = {
  [key in ShipType]?: ShipCompositionRule;
}

export interface ExpeditorSettings {
  origins: number[],
  holdTime?: number,
  fleet: FleetCompositionRule
}

export class Expeditor {
  constructor(private readonly launcher: Launcher,
              private readonly player: PlayerContext,
              public settings: ExpeditorSettings) {
  }

  async start(...counts: number[]): Promise<unknown[]> {
    if (counts.length !== this.settings.origins.length)
      console.warn(`requested and configured target counts do not match`);
    const len = Math.min(counts.length, this.settings.origins.length);
    const result = [] as Promise<unknown>[];
    const holdTime = Math.max(this.settings.holdTime || 1, 1);
    const bodies = await this.getBodies();
    const fleets = await this.calculateFleets(bodies, counts);
    for (let idx = 0; idx < len; ++idx) {
      const count = counts[idx];
      const from = bodies[idx].id;
      const to = {
        galaxy: bodies[idx].coordinates.galaxy,
        system: bodies[idx].coordinates.system,
        position: 16
      } as Coordinates;
      for (let i = 0; i < count; ++i) {
        const launchResult = this.launcher.launch({
          mission: MissionType.Expedition,
          fleet: fleets[idx],
          from,
          to,
          holdTime
        });
        result.push(launchResult);
      }
    }
    return Promise.all(result);
  }

  private async getBodies(): Promise<SpaceBody[]> {
    const allBodies = await this.player.getBodies();
    return this.settings.origins.map(id => allBodies.find(body => id === body.id)!);
  }

  private async calculateFleets(bodies: SpaceBody[], counts: number[]): Promise<FleetPartial[]> {
    let allFleets: Fleet[] = await processAll(bodies, async body => this.player.getFleet(body.id));
    let result: FleetPartial[] = Array(bodies.length);
    for (let i = 0; i < bodies.length; ++i) {
      const allFleet = allFleets[i];
      const n = counts[i];
      if (n > 0)
        result[i] = this.computeExpeditionFleet(this.settings.fleet, allFleet, n);
    }
    return result;
  }

  private computeExpeditionFleet(rule: FleetCompositionRule, allFleet: Fleet, n: number): FleetPartial {
    const result: FleetPartial = {};
    let baseMax = Infinity;
    for (let key in rule) {
      const shipType = key as ShipType;
      const shipRule = rule[shipType]!;
      let available = allFleet[shipType] || 0;
      if (shipRule.reserved)
        available -= shipRule.reserved;
      if (shipRule.type === 'varying') {
        baseMax = Math.min(available / n / shipRule.min, baseMax);
        baseMax = Math.max(0, baseMax);
      }
    }
    for (let key in rule) {
      const shipType = key as ShipType;
      const shipRule = rule[shipType]!;
      let available = allFleet[shipType] || 0;
      if (shipRule.reserved)
        available -= shipRule.reserved;
      if (shipRule.type === 'fixed') {
        result[shipType] = Math.min(Math.floor(available / n), shipRule.max);
      } else if (shipRule.type === 'varying') {
        result[shipType] = Math.floor(Math.min(available / n, baseMax * shipRule.max));
        result[shipType] = Math.max(0, result[shipType]!);
      }
    }
    return result;
  }
}
