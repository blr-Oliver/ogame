import {PlayerContext} from '../core/PlayerContext';
import {Coordinates, FleetPartial, MissionType, SpaceBody} from '../types';
import {Launcher} from './Mapper';

export interface ExpeditorSettings {
  fleet: FleetPartial,
  origins: number[],
  holdTime?: number
}

export class Expeditor {
  private bodies: SpaceBody[] = [];
  constructor(private readonly launcher: Launcher,
              public settings: ExpeditorSettings) {
  }

  async initBodies(player: PlayerContext): Promise<SpaceBody[]> {
    // TODO this should be executed every time settings.origins is updated
    const plainBodies = await player.getBodies();
    const bodyById = plainBodies.reduce((hash, body) => (hash[body.id] = body, hash), {} as { [id: number]: SpaceBody });
    this.bodies = this.settings.origins
        .map(id => bodyById[id]);
    return this.bodies;
  }

  async start(...counts: number[]): Promise<unknown[]> {
    if (counts.length !== this.settings.origins.length)
      console.warn(`requested and configured target counts do not match`);
    const len = Math.min(counts.length, this.settings.origins.length);
    const result = [] as Promise<unknown>[];
    const holdTime = Math.max(this.settings.holdTime || 1, 1);
    for (let idx = 0; idx < len; ++idx) {
      const count = counts[idx];
      const from = this.bodies[idx].id;
      const to = {
        galaxy: this.bodies[idx].coordinates.galaxy,
        system: this.bodies[idx].coordinates.system,
        position: 16
      } as Coordinates;
      for (let i = 0; i < count; ++i) {
        const launchResult = this.launcher.launch({
          mission: MissionType.Expedition,
          fleet: this.settings.fleet,
          from,
          to,
          holdTime
        });
        result.push(launchResult);
      }
    }
    return Promise.all(result);
  }
}
