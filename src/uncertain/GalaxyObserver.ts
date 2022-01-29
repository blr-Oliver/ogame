import {JSDOM} from 'jsdom';
import {parseGalaxy} from '../browser/parsers/galaxy-reports';
import {processAll, waitUntil} from '../common/common';
import {GalaxySystemInfo, ObserveParams} from '../common/report-types';
import {GalaxyRepository} from '../common/repository-types';
import {Coordinates} from '../common/types';
import {Fetcher, LegacyMapper, RequestOptions} from './LegacyMapper';

export class GalaxyObserver {
  readonly observe: ObserveParams = {
    pause: true,
    galaxyMin: 1,
    galaxyMax: 7,
    systemMin: 1,
    systemMax: 499,
    galaxyLast: null,
    systemLast: null,
    emptyTimeout: 3600 * 36,
    normalTimeout: 3600 * 2
  };

  private observeNext: any | null = null;

  constructor(private galaxyRepo: GalaxyRepository,
              private fetcher: Fetcher) {
  }

  observeSystem(galaxy: number, system: number): Promise<GalaxySystemInfo> {
    return this.fetcher.fetch({
      url: LegacyMapper.GAME_URL,
      method: 'POST',
      json: true,
      query: {
        page: 'galaxyContent',
        ajax: 1
      },
      body: {
        galaxy: galaxy,
        system: system
      }
    } as RequestOptions)
        .then(galaxyResponse => {
          let timestamp: Date = galaxyResponse.headers.date ? new Date(galaxyResponse.headers.date) : new Date();
          return parseGalaxy(JSDOM.fragment(galaxyResponse.body['galaxy']), timestamp);
        });
  }

  observeAllSystems(systems: Coordinates[]): Promise<GalaxySystemInfo[]> {
    // TODO maybe bulk store to GalaxyRepository instead of chain?
    let storeChain: Promise<any> = Promise.resolve();
    let result = processAll(systems, coords => {
      let infoPromise: Promise<GalaxySystemInfo> = this.observeSystem(coords.galaxy, coords.system);
      storeChain = storeChain.then(() => infoPromise.then(info => this.galaxyRepo.store(info)));
      return infoPromise;
    });

    return waitUntil(result, storeChain);
  }

  continueObserve() {
    const params = this.observe;
    if (this.observeNext) {
      clearTimeout(this.observeNext);
      this.observeNext = null;
    }
    if (!params.pause) {
      params.pause = true;
      this.galaxyRepo.findNextStale(
          params.galaxyMin, params.galaxyMax, params.systemMin, params.systemMax, params.galaxyLast, params.systemLast,
          params.normalTimeout, params.emptyTimeout
      ).then(nextTarget => {
        if (!nextTarget) {
          params.galaxyLast = null;
          params.systemLast = null;
        } else {
          let galaxyNext: number = nextTarget.galaxy;
          let systemNext: number = nextTarget.system;
          this.observeSystem(galaxyNext, systemNext)
              .then(info => this.galaxyRepo.store(info))
              .then(() => {
                params.pause = false;
                params.galaxyLast = galaxyNext;
                params.systemLast = systemNext;
                this.observeNext = setTimeout(() => this.continueObserve(), 0);
              });
        }
      });
    }
  }

}

