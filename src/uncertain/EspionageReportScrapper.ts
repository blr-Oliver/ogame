import {processAll} from '../common/common';
import {Fetcher} from '../common/core/Fetcher';
import {ServerContext} from '../common/core/ServerContext';
import {EspionageReportParser} from '../common/parsers';
import {StampedEspionageReport} from '../common/report-types';
import {EspionageRepository} from '../common/repository-types';

export class EspionageReportScrapper {
  loadingQueue: number[] = []; // TODO handle queue contents more reliably

  constructor(private repo: EspionageRepository,
              private parser: EspionageReportParser,
              private fetcher: Fetcher,
              private serverContext: ServerContext) {
  }

  loadReportList(): Promise<number[]> {
    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      method: 'GET',
      query: {
        page: 'messages',
        tab: 20,
        ajax: 1
      }
    })
        .then(response => response.text())
        .then(body => this.parser.parseReportList(body))
        .then(idList => idList.sort());
  }

  loadReport(id: number): Promise<StampedEspionageReport | undefined> {
    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      query: {
        page: 'messages',
        messageId: id,
        tabid: 20,
        ajax: 1
      }
    })
        .then(response => response.text())
        .then(body => this.parser.parseReport(body));
  }

  deleteReport(id: number): Promise<void> {
    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
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
                    let beforeDelete: Promise<any> = report ? this.repo.store(report) : Promise.resolve();
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
