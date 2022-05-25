import {FloodGate} from '../core/parallel-limit';
import {UniverseContext} from '../core/UniverseContext';
import {GalaxySystemInfo} from '../report-types';
import {GalaxyRepository} from '../repository-types';
import {SystemCoordinates} from '../types';
import {AutoObserve, AutoObserveSettings, AutoObserveStatus} from './AutoObserve';
import {GalaxyObserver} from './GalaxyObserver';

export class StatefulAutoObserve implements AutoObserve {
  private handler: FloodGate<(galaxy: number, system: number) => Promise<GalaxySystemInfo>>;
  #nextWakeUp?: Date;
  #status: AutoObserveStatus = 'idle';
  #scheduledContinueId?: number;

  constructor(
      private observer: GalaxyObserver,
      private repo: GalaxyRepository,
      private universe: UniverseContext,
      public readonly settings: AutoObserveSettings
  ) {
    this.handler = new FloodGate((galaxy: number, system: number) => observer.observe(galaxy, system), 10, settings.delay);
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
        const threshold = now - this.settings.timeout * 1000;
        const emptyThreshold = now - this.settings.emptyTimeout * 1000;

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
