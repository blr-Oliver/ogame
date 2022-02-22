import {EspionageReportList} from '../../browser/parsers/no-dom/espionage-report-no-dom';
import {processAll} from '../common';
import {Fetcher} from '../core/Fetcher';
import {ServerContext} from '../core/ServerContext';
import {EspionageReportParser} from '../parsers';
import {StampedEspionageReport} from '../report-types';
import {EspionageRepository} from '../repository-types';

export class EspionageReportScrapper {
  loadingQueue: number[] = []; // TODO handle queue contents more reliably
  private lastToken: string = '00000000000000000000000000000000';

  constructor(private repo: EspionageRepository,
              private parser: EspionageReportParser,
              private fetcher: Fetcher,
              private serverContext: ServerContext) {
  }

  loadReportList(): Promise<EspionageReportList> {
    return this.getListResponse()
        .then(body => this.parser.parseReportList(body))
        .then(reportList => {
          this.lastToken = reportList.token;
          return reportList;
        });
  }

  private getListResponse(): Promise<string> {
    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      method: 'GET',
      query: {
        page: 'messages',
        tab: 20,
        ajax: 1
      }
    }).then(response => response.text());
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

  async deleteReport(id: number, token?: string): Promise<string/*new token*/> {
    let response = await this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      method: 'POST',
      query: {
        page: 'messages'
      },
      body: {
        messageId: id,
        action: 103,
        token: token || this.lastToken,
        ajax: 1
      },
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    try {
      let data = await response.json();
      return this.lastToken = data['newAjaxToken'];
    } catch (e) {
      if (token) throw e; // no second retry
      let listResponse = await this.getListResponse();
      return this.deleteReport(id, this.parser.parseReportList(listResponse).token);
    }
  }

  async loadAllReports(): Promise<StampedEspionageReport[]> {
    const reportList = await this.loadReportList();
    this.loadingQueue = reportList.reports.map(report => report.id).sort((a, b) => a - b);
    let idList = this.loadingQueue.slice();
    let result = await processAll(idList, async id => {
      let report = await this.loadReport(id);
      if (report) {
        await this.repo.store(report);
        await this.deleteReport(id);
      }
      this.loadingQueue.splice(this.loadingQueue.indexOf(id), 1);
      return report;
    });
    if (!result.length) return result;
    return this.loadAllReports().then(nextPage => (result.push(...nextPage), result));
  }
}
