import {FloodGate} from '../core/FloodGate';
import {ListenableObject, PropertyChangeListener} from '../core/PropertyChangeEvent';
import {UniverseContext} from '../../uniplatform/core/UniverseContext';
import {GalaxySystemInfo} from '../../uniplatform/core/types/reports';
import {GalaxyRepository} from '../../uniplatform/core/types/repositories';
import {SystemCoordinates} from '../../uniplatform/core/types/core';
import {AutoObserve, AutoObserveSettings, AutoObserveStatus} from './AutoObserve';
import {GalaxyObserver} from './operations/GalaxyObserver';

export class StatefulAutoObserve implements AutoObserve {
  private handler: FloodGate<(galaxy: number, system: number) => Promise<GalaxySystemInfo>>;
  #nextWakeUp?: Date;
  #status: AutoObserveStatus = 'idle';
  #scheduledContinueId?: number;

  constructor(
      private observer: GalaxyObserver,
      private repo: GalaxyRepository,
      private universe: UniverseContext,
      public readonly settings: ListenableObject<AutoObserveSettings>
  ) {
    this.handler = new FloodGate((galaxy: number, system: number) => observer.observe(galaxy, system), 10, settings.delay);
    settings.onBefore(null, e => {
      let zeroAllowed = e.property === 'delay';
      if (e.newValue < 0 || !zeroAllowed && e.newValue === 0) {
        e.cancel();
        console.warn(`Attempt to set property [${e.property}: ${e.oldValue} => ${e.newValue}] cancelled (invalid value)`);
      }
    });
    settings.onAfter('delay', e => this.handler.delay = e.newValue);
    const restarter: PropertyChangeListener<AutoObserveSettings, keyof AutoObserveSettings> = e => {
      this.handler.dropWaiting();
      this.continue();
    };
    settings.onAfter('emptyTimeout', restarter);
    settings.onAfter('timeout', restarter);
  }

  get status(): AutoObserveStatus {
    return this.#status;
  }

  get nextWakeUp(): Date | undefined {
    return this.#nextWakeUp;
  }

  pause(): void {
    this.#status = 'paused';
    this.#clearSchedule();
    this.handler.paused = true;
  }

  reset(): void {
    this.handler.dropWaiting();
  }

  #clearSchedule() {
    this.#nextWakeUp = undefined;
    if (this.#scheduledContinueId) {
      clearTimeout(this.#scheduledContinueId);
      this.#scheduledContinueId = undefined;
    }
  }

  async continue(): Promise<void> {
    this.#status = 'active';
    this.#clearSchedule();
    this.handler.paused = false;
    if (!this.handler.queue.length) {
      let [latest, missing] = await Promise.all([
        this.repo.selectLatestReports(),
        this.repo.findAllMissing(this.universe.maxGalaxy, this.universe.maxSystem)
      ]);

      if (!this.handler.paused) {
        const now = Date.now();
        // also invalidate reports that are within 5% of allowed threshold
        // with this batches will be slightly larger but not continuous
        const threshold = now - this.settings.timeout * 1000 * 0.95;
        const emptyThreshold = now - this.settings.emptyTimeout * 1000 * 0.95;

        let emptyOk: GalaxySystemInfo[] = [],
            normalOk: GalaxySystemInfo[] = [],
            tasks: SystemCoordinates[] = [];
        latest.forEach(report => {
          if (report.empty) {
            if (report.timestamp!.getTime() < emptyThreshold)
              tasks.push([report.galaxy, report.system]);
            else emptyOk.push(report);
          } else {
            if (report.timestamp!.getTime() < threshold)
              tasks.push([report.galaxy, report.system]);
            else normalOk.push(report);
          }
        });

        tasks.push(...missing);
        if (tasks.length) {
          Promise.allSettled(tasks.map(c => this.handler.offer(c[0], c[1])))
              .then(() => {
                if (!this.handler.paused)
                  this.continue();
              });
        } else {
          let maxEmptyTime = emptyOk[0]?.timestamp!.getTime() || now,
              maxTime = normalOk[0]?.timestamp!.getTime() || now;
          let nextWakeUp = Math.min(maxEmptyTime + this.settings.emptyTimeout * 1000, maxTime + this.settings.timeout * 1000);
          this.#nextWakeUp = new Date(nextWakeUp);
          this.#status = 'sleeping';
          this.#scheduledContinueId = setTimeout(() => this.continue(), nextWakeUp - now);
        }
      }
    }
  }

  enqueue(...systems: SystemCoordinates[]): void {
    // this doesn't change any status
    for (let coords of systems)
      this.handler.offer(coords[0], coords[1]);
  }
}
