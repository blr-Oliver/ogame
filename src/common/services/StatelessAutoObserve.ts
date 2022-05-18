import {compareCoordinatesKeys} from '../common';
import {UniverseContext} from '../core/UniverseContext';
import {GalaxyRepository} from '../repository-types';
import {SystemCoordinates} from '../types';
import {AutoObserve, AutoObserveSettings, Status} from './AutoObserve';
import {GalaxyObserver} from './GalaxyObserver';

export class StatelessAutoObserve implements AutoObserve {
  #status: Status = 'idle';
  #nextWakeUp?: Date;
  #nextSystem?: SystemCoordinates;
  #nextWakeUpId?: number;

  constructor(private observer: GalaxyObserver,
              private repo: GalaxyRepository,
              private universe: UniverseContext,
              public readonly settings: AutoObserveSettings) {
  }

  async continue() {
    if (this.#nextWakeUpId)
      this.clearWakeUp();
    if (this.#nextSystem) {
      // deliberately not waiting for observe to finish
      this.observer.observe(this.#nextSystem[0], this.#nextSystem[1]);
      if (++this.#nextSystem[1] > this.universe.maxSystem) {
        this.#nextSystem[1] = 1;
        ++this.#nextSystem[0];
      }
    }
    let [nextStale, nextMissing] = await Promise.all([
      this.repo.findNextStale(this.settings.timeout, this.settings.emptyTimeout, this.#nextSystem),
      this.repo.findNextMissing(this.universe.maxGalaxy, this.universe.maxSystem, this.#nextSystem)
    ]);

    if (nextStale) {
      if (nextMissing)
        this.#nextSystem = compareCoordinatesKeys(nextStale, nextMissing) < 0 ? nextStale : nextMissing;
      else
        this.#nextSystem = nextStale;
    } else
      this.#nextSystem = nextMissing;

    this.scheduleWakeUp();
  }

  pause() {
    if (this.#status !== 'idle') this.#status = 'paused';
    this.clearWakeUp();
  }

  private clearWakeUp() {
    clearTimeout(this.#nextWakeUpId);
    this.#nextWakeUpId = undefined;
    this.#nextWakeUp = undefined;
  }

  private scheduleWakeUp() {
    const delay = this.#nextSystem ? this.settings.delay : (250 * this.settings.timeout);
    this.#nextWakeUp = new Date(Date.now() + delay);
    this.#nextWakeUpId = setTimeout(() => this.continue(), delay);
    this.#status = this.#nextSystem ? 'active' : 'idle';
  }

  get scheduledContinue(): Date | undefined {
    return this.#nextWakeUp;
  }

  get status(): Status {
    return this.#status;
  }

  /**
   * @deprecated
   */
  get queue(): SystemCoordinates[] {
    return this.#nextSystem ? [this.#nextSystem] : [];
  }

  /**
   * @deprecated
   */
  get inProgress(): SystemCoordinates[] {
    return this.#status === 'active' ? this.queue : [];
  }

  get nextSystem(): SystemCoordinates | undefined {
    return this.#nextSystem;
  }

  enqueue(...systems: SystemCoordinates[]) {
    throw new Error('will not be implemented'); // FIXME
  }
}
