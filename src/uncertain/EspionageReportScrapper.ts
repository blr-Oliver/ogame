import {JSDOM} from 'jsdom';
import {parseReport, parseReportList} from '../browser/parsers/espionage-reports';
import {processAll} from '../common/common';
import {StampedEspionageReport} from '../common/report-types';
import {EspionageRepository} from '../common/repository-types';
import {Fetcher, LegacyMapper} from './LegacyMapper';

export class EspionageReportScrapper {
  loadingQueue: number[] = []; // TODO handle queue contents more reliably

  constructor(private espionageRepo: EspionageRepository,
              private fetcher: Fetcher) {
  }

  loadReportList(): Promise<number[]> {
    return this.fetcher.fetch({
      url: LegacyMapper.GAME_URL,
      method: 'GET',
      query: {
        page: 'messages',
        tab: 20,
        ajax: 1
      }
    })
        .then(response => parseReportList(JSDOM.fragment(response.body)))
        .then(idList => idList.sort());
  }

  loadReport(id: number): Promise<StampedEspionageReport | undefined> {
    return this.fetcher.fetch({
      url: LegacyMapper.GAME_URL,
      query: {
        page: 'messages',
        messageId: id,
        tabid: 20,
        ajax: 1
      }
    })
        .then(response => parseReport(JSDOM.fragment(response.body)));
  }

  deleteReport(id: number): Promise<void> {
    return this.fetcher.fetch({
      url: LegacyMapper.GAME_URL,
      method: 'POST',
      query: {
        page: 'messages'
      },
      body: {
        messageId: id,
        action: 103,
        ajax: 1
      }
    }).then(() => void 0);
  }

  loadAllReports(): Promise<StampedEspionageReport[]> {
    return this.loadReportList().then(idList => {
          this.loadingQueue = idList;
          return processAll(idList, id =>
              this.loadReport(id)
                  .then(report => {
                    let beforeDelete: Promise<any> = report ? this.espionageRepo.store(report) : Promise.resolve();
                    return beforeDelete
                        .then(() => this.deleteReport(id))
                        .then(() => this.loadingQueue.shift())
                        .then(() => report);
                  }));
        }
    ).then(result => {
      if (!result.length) return result;
      return this.loadAllReports().then(nextPage => (result.push(...nextPage), result));
    });
  }

}
