import {after, processAll, waitUntil} from 'ogame-common/common';
import {ServerContext} from 'ogame-core/context/ServerContext';
import {Coordinates} from 'ogame-core/types/core';
import {GalaxyParser} from '../../../uniplatform/core/types/parsers';
import {GalaxySystemInfo} from '../../../uniplatform/core/types/reports';
import {GalaxyHistoryRepository, GalaxyRepository} from '../../../uniplatform/core/types/repositories';
import {Fetcher, RequestFacade} from '../../core/Fetcher';

export class GalaxyObserver {
  private readonly requestTemplate: RequestFacade;

  constructor(private repo: GalaxyRepository,
              private historyRepo: GalaxyHistoryRepository,
              private parser: GalaxyParser,
              public fetcher: Fetcher,
              public serverContext: ServerContext) {
    this.requestTemplate = {
      url: this.serverContext.gameUrl,
      method: 'POST',
      query: {
        page: 'ingame',
        component: 'galaxy',
        action: 'fetchGalaxyContent',
        ajax: 1,
        asJson: 1
      },
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    }
  }

  async observe(galaxy: number, system: number, parallelSave: boolean = false, skipSave: boolean = false): Promise<GalaxySystemInfo> {
    // TODO tie request strategy with parsing strategy
    const options: RequestFacade = {
      ...this.requestTemplate,
      body: {
        galaxy: galaxy,
        system: system
      }
    };
    const reportPromise = this.fetcher.fetch(options)
        .then(response => {
          let timestamp: Date = response.headers.has('date') ? new Date(response.headers.get('date')!) : new Date();
          return response.text().then(text => this.parser.parseGalaxy(text, timestamp))
        });
    return skipSave ? reportPromise : after(reportPromise,
        report => Promise.all([this.repo.store(report), this.historyRepo.store(report)]),
        parallelSave);
  }

  observeC(system: Coordinates, parallelSave: boolean = false, skipSave: boolean = false): Promise<GalaxySystemInfo> {
    return this.observe(system.galaxy, system.system, parallelSave, skipSave);
  }

  observeAll(systems: Coordinates[], parallel: boolean = false, parallelSave: boolean = false, skipWaitingSave: boolean = false, skipSave: boolean = false): Promise<GalaxySystemInfo[]> {
    // TODO maybe bulk store to GalaxyRepository?
    if (skipSave) return processAll(systems, coords => this.observeC(coords, true, true), parallel);
    if (parallelSave) {
      if (skipWaitingSave)
        return processAll(systems, coords => this.observeC(coords, true, false), parallel);
      else {
        let saveTasks: Promise<any>[] = [];
        let observeTask = processAll(systems, coords => {
          let infoPromise: Promise<GalaxySystemInfo> = this.observeC(coords, true, true);
          saveTasks.push(infoPromise.then(report => this.repo.store(report)));
          return infoPromise;
        }, parallel);
        return waitUntil(observeTask, ...saveTasks);
      }
    } else
      return processAll(systems, coords => this.observeC(coords, false, false), parallel);
  }
}

