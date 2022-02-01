import {GameContext} from '../core/GameContext';
import {GalaxyRepository} from '../repository-types';
import {Coordinates} from '../types';
import {GalaxyObserver} from './GalaxyObserver';

export interface ObserveSettings {
  pause: boolean;
  emptyTimeout: number;  // seconds
  normalTimeout: number; // seconds
  delay: number; // milliseconds
}

export const DEFAULT_OBSERVE_SETTINGS: ObserveSettings = {
  pause: true,
  emptyTimeout: 3600 * 36,
  normalTimeout: 3600 * 2,
  delay: 500
};

export class AutoObserve {
  private observeNext: any | null = null;
  readonly settings: ObserveSettings = {...DEFAULT_OBSERVE_SETTINGS};
  readonly queue: Coordinates[] = [];
  processing = 0;

  constructor(private repo: GalaxyRepository,
              private gameContext: GameContext,
              private observer: GalaxyObserver) {
  }

  continueObserve() {
    if (this.observeNext) {
      clearTimeout(this.observeNext);
      this.observeNext = null;
    }
    if (!this.settings.pause) {
      if (this.queue.length) {
        let next: Coordinates = this.queue.shift()!;
        ++this.processing;
        this.observer.observeC(next)
            .then(() => --this.processing, e => {
              --this.processing;
              this.queue.push(next);
            });
        this.observeNext = setTimeout(() => this.continueObserve(), this.settings.delay);
      } else {
        if (this.processing <= 0) {
          this.fillQueue()
              .then(() => {
                if (!this.queue.length)
                  this.observeNext = setTimeout(() => this.continueObserve(), this.settings.normalTimeout / 100);
                else this.continueObserve();
              });
        } else
          this.observeNext = setTimeout(() => this.continueObserve(), this.settings.normalTimeout / 100);
      }
    }
  }

  private fillQueue(): Promise<void> {
    return Promise.all([
      this.repo.findAllMissing(this.gameContext.maxGalaxy, this.gameContext.maxSystem),
      this.repo.findAllStale(this.settings.normalTimeout, this.settings.emptyTimeout)
    ]).then(([missing, stale]) => {
      let i = this.queue.length;
      this.queue.length += missing.length + stale.length;
      for (let j = 0; j < missing.length; ++i, ++j)
        this.queue[i] = missing[j];
      for (let j = 0; j < stale.length; ++i, ++j)
        this.queue[i] = stale[j];
    });
  }
}
