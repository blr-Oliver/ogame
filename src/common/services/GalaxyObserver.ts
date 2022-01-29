import {processAll, waitUntil} from '../common';
import {Fetcher} from '../core/Fetcher';
import {GameContext} from '../core/GameContext';
import {ServerContext} from '../core/ServerContext';
import {GalaxyParser} from '../parsers';
import {GalaxySystemInfo} from '../report-types';
import {GalaxyRepository} from '../repository-types';
import {Coordinates} from '../types';

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

export class GalaxyObserver {
  readonly settings: ObserveSettings = {...DEFAULT_OBSERVE_SETTINGS};

  private observeNext: any | null = null;

  constructor(private repo: GalaxyRepository,
              private parser: GalaxyParser,
              private fetcher: Fetcher,
              private serverContext: ServerContext,
              private gameContext: GameContext) {
  }

  observeSystem(galaxy: number, system: number): Promise<GalaxySystemInfo> {
    // TODO tie request strategy with parsing strategy
    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      method: 'POST',
      query: {
        page: 'ingame',
        component: 'galaxy',
        action: 'fetchGalaxyContent',
        ajax: 1,
        asJson: 1
      },
      body: {
        galaxy: galaxy,
        system: system
      },
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
        .then(response => {
          let timestamp: Date = response.headers.has('date') ? new Date(response.headers.get('date')!) : new Date();
          return response.text().then(text => this.parser.parseGalaxy(text, timestamp))
        })
        .then(report => {
          this.repo.store(report); // not waiting
          console.log([report.galaxy, report.system]);
          return report;
        });
  }


  observeAllSystems(systems: Coordinates[]): Promise<GalaxySystemInfo[]> {
    // TODO maybe bulk store to GalaxyRepository instead of chain?
    let storeChain: Promise<any> = Promise.resolve();
    let result = processAll(systems, coords => {
      let infoPromise: Promise<GalaxySystemInfo> = this.observeSystem(coords.galaxy, coords.system);
      storeChain = storeChain.then(() => infoPromise.then(info => this.repo.store(info)));
      return infoPromise;
    });

    return waitUntil(result, storeChain);
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
              let galaxyNext: number = next.galaxy;
              let systemNext: number = next.system;
              this.observeSystem(galaxyNext, systemNext)
                  .then(() => {
                    s.last = {
                      galaxy: galaxyNext,
                      system: systemNext
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

  private tryFind(restart: boolean = false): Promise<Coordinates | undefined> {
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

