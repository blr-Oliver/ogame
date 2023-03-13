import {GalaxyObserver, GalaxySystemInfo} from 'ogame-api-facade';
import {after} from 'ogame-common';
import {Coordinates, ServerContext} from 'ogame-core';
import {GalaxyHistoryRepository, GalaxyRepository} from 'ogame-repository-facade';
import {GalaxyParser} from '../../../uniplatform/parsers';
import {Fetcher, RequestFacade} from '../../core/Fetcher';

export class AjaxGalaxyObserver implements GalaxyObserver {
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
}
