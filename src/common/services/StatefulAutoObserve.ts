import {deduplicate, systemCoordinatesKey} from '../common';
import {GameContext} from '../core/GameContext';
import {AsyncSupplier} from '../functional';
import {GalaxyRepository} from '../repository-types';
import {SystemCoordinates} from '../types';
import {AutoObserve, AutoObserveSettings, Status} from './AutoObserve';
import {GalaxyObserver} from './GalaxyObserver';

const DEFAULT_DELAY = 500;
const DEFAULT_TIMEOUT = 3600 * 2;
const DEFAULT_EMPTY_TIMEOUT = 3600 * 36;

class ReactiveAutoObserveSettings implements AutoObserveSettings {
  private readonly notifier: () => void;
  private _delay: number;
  private _timeout: number;
  private _emptyTimeout: number;

  constructor(settings: AutoObserveSettings, notifier: () => void) {
    this.notifier = notifier;
    this._delay = settings.delay;
    this._timeout = settings.timeout;
    this._emptyTimeout = settings.emptyTimeout;
  }

  get delay(): number {
    return this._delay;
  }
  get timeout(): number {
    return this._timeout;
  }
  get emptyTimeout(): number {
    return this._emptyTimeout;
  }

  set delay(value: number) {
    this._delay = value;
    setTimeout(this.notifier, 0);
  }
  set timeout(value: number) {
    this._timeout = value;
    setTimeout(this.notifier, 0);
  }
  set emptyTimeout(value: number) {
    this._emptyTimeout = value;
    setTimeout(this.notifier, 0);
  }
}

export class StatefulAutoObserve implements AutoObserve {
  private readonly _queue: SystemCoordinates[] = [];
  private readonly queued: Set<string> = new Set<string>();
  private readonly processingDict: Map<string, SystemCoordinates> = new Map<string, SystemCoordinates>();

  private _status: Status;
  private _scheduledContinue?: Date;
  private _scheduledWakeUpId: any;

  readonly settings: AutoObserveSettings;

  constructor(private readonly observer: GalaxyObserver,
              private readonly repo: AsyncSupplier<GalaxyRepository>,
              private readonly gameContext: GameContext,
              settings?: Partial<AutoObserveSettings>) {
    this.settings = new ReactiveAutoObserveSettings(Object.assign({
      delay: DEFAULT_DELAY,
      timeout: DEFAULT_TIMEOUT,
      emptyTimeout: DEFAULT_EMPTY_TIMEOUT
    }, settings), () => this.settingsChanged());
    this._status = 'paused';
  }

  get status(): Status {
    return this._status;
  }
  get scheduledContinue(): Date | undefined {
    return this._scheduledContinue;
  }
  get queue(): SystemCoordinates[] {
    return this._queue.slice();
  }
  get inProgress(): SystemCoordinates[] {
    return [...this.processingDict.values()];
  }

  private wakeUp() {
    this.cancelNextWakeUp();
    switch (this._status) {
      case 'paused':
        return;
      case 'idle':
        this._status = 'active';
        // no break
      case 'active':
        if (this._queue.length) {
          this.pollQueue();
        } else if (!this.processingDict.size) {
          this.buildQueue();
        } else {
          // do nothing, just wait processing items to finish
        }
    }
  }
  private cancelNextWakeUp() {
    this._scheduledContinue = undefined;
    if (this._scheduledWakeUpId)
      clearTimeout(this._scheduledWakeUpId);
    this._scheduledWakeUpId = undefined;
  }
  private pollQueue() {
    if (this._queue.length) {
      const next: SystemCoordinates = this._queue.shift()!;
      const key = systemCoordinatesKey(next);
      this.queued.delete(key);
      this.processingDict.set(key, next);
      this.observer.observe(next[0], next[1])
          .then(
              () => {
                this.processingDict.delete(key);
                this.buildQueue();
              },
              () => {
                this.processingDict.delete(key);
                this.doEnqueue(next);
                this.wakeUp();
              }
          );
      this.scheduleWakeUp(this.settings.delay);
    }
  }
  private buildQueue() {
    if (this._status === 'paused') return;
    if (!this._queue.length && !this.processingDict.size) {
      this.repo()
          .then(repo => Promise.all([
            repo.findAllMissing(this.gameContext.maxGalaxy, this.gameContext.maxSystem),
            repo.findAllStale(this.settings.timeout, this.settings.emptyTimeout)
          ]))
          .then(([missing, stale]) => {
            const systems = missing.concat(stale).map(c => [c.galaxy, c.system] as SystemCoordinates);
            if (systems.length) {
              this.doEnqueue(...systems);
              this.scheduleWakeUp(this.settings.delay);
            } else {
              // TODO compute accurate schedule
              const timeToSleep = this.settings.timeout * 1000 / 4;
              this._scheduledContinue = new Date(Date.now() + timeToSleep);
              this.scheduleWakeUp(timeToSleep);
              this._status = 'idle';
            }
          });
    }
  }
  private scheduleWakeUp(delay: number) {
    this.cancelNextWakeUp();
    this._scheduledWakeUpId = setTimeout(() => this.wakeUp(), delay);
  }
  private settingsChanged() {
    this.cancelNextWakeUp();
    this._queue.length = 0;
    this.buildQueue();
  }
  private doEnqueue(...systems: SystemCoordinates[]) {
    if (systems && systems.length) {
      let withKeys = systems
          .map(c => ({c, key: systemCoordinatesKey(c)}));
      withKeys = deduplicate(withKeys, (a, b) => a.key.localeCompare(b.key));
      withKeys
          .filter(r => !this.queued.has(r.key) && !this.processingDict.has(r.key))
          .forEach(r => {
            this.queued.add(r.key);
            this._queue.push(r.c);
          });
    }
  }

  pause() {
    switch (this._status) {
      case 'paused':
        return;
      case 'idle':
      case 'active':
        this.cancelNextWakeUp();
        this._status = 'paused';
    }
  }
  continue() {
    switch (this._status) {
      case 'paused':
        this._status = this._queue.length ? 'active' : 'idle';
        this.scheduleWakeUp(0);
        break;
      case 'idle':
      case 'active':
        return;
    }
  }
  enqueue(...systems: SystemCoordinates[]) {
    this.doEnqueue(...systems);
    this.scheduleWakeUp(0);
  }
}
