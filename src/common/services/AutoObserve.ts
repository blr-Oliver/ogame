import {GameContext} from '../core/GameContext';
import {GalaxyRepository} from '../repository-types';
import {Coordinates} from '../types';
import {GalaxyObserver} from './GalaxyObserver';

export interface SystemCoordinates {
  galaxy?: number;
  system?: number
}

export interface ObserveSettings {
  pause: boolean;
  emptyTimeout: number;  // seconds
  normalTimeout: number; // seconds
  delay: number; // milliseconds
  from?: SystemCoordinates;
  to?: SystemCoordinates;
  last?: Required<SystemCoordinates>;
}

export const DEFAULT_OBSERVE_SETTINGS: ObserveSettings = {
  pause: true,
  emptyTimeout: 3600 * 36,
  normalTimeout: 3600 * 2,
  delay: 500
};

export class AutoObserve{
  readonly settings: ObserveSettings = {...DEFAULT_OBSERVE_SETTINGS};
  private observeNext: any | null = null;

  constructor(private repo: GalaxyRepository,
              private gameContext: GameContext,
              private observer: GalaxyObserver) {
  }


  continueObserve() {
    const s = this.settings;
    if (this.observeNext) {
      clearTimeout(this.observeNext);
      this.observeNext = null;
    }
    if (!s.pause) {
      this.tryFind()
          .then(next => {
            if (!next && s.last) return this.tryFind(true)
            else return next;
          })
          .then(next => {
            if (next) {
              this.observer.observeC(next)
                  .then(() => {
                    s.last = {
                      galaxy: next.galaxy,
                      system: next.system
                    }
                    this.observeNext = setTimeout(() => this.continueObserve(), s.delay);
                  });
            } else {
              // TODO schedule long timeout where systems become stale once again
              s.pause = true;
              s.last = undefined;
            }
          });
    }
  }

  tryFind(restart: boolean = false): Promise<Coordinates | undefined> {
    const s = this.settings;
    const maxS = this.gameContext.maxSystem;
    const fromG = s.from?.galaxy || 1;
    const toG = s.to?.galaxy || this.gameContext.maxGalaxy;
    const fromS = s.from?.system || 1;
    const toS = s.to?.system || maxS;
    const gLast = restart ? undefined : s.last?.galaxy;
    const sLast = restart ? undefined : s.last?.system;
    return this.repo.findNextMissing(fromG, toG, fromS, toS, maxS, gLast, sLast)
        .then(c => c || this.repo.findNextStale(fromG, toG, fromS, toS, s.normalTimeout, s.emptyTimeout, gLast, sLast));
  }

}
