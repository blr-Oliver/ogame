import {EspionageBrief, EspionageReportList} from '../../browser/parsers/no-dom/espionage-report-no-dom';
import {deduplicate} from '../common';
import {Fetcher} from '../core/Fetcher';
import {ServerContext} from '../core/ServerContext';
import {EspionageReportParser} from '../parsers';
import {StampedEspionageReport} from '../report-types';
import {EspionageRepository} from '../repository-types';

export class EspionageReportScrapper {
  loadingQueue: EspionageBrief[] = [];
  private lastToken: string = '00000000000000000000000000000000';

  constructor(private repo: EspionageRepository,
              private parser: EspionageReportParser,
              private fetcher: Fetcher,
              private serverContext: ServerContext) {
  }

  async loadReportList(): Promise<EspionageReportList> {
    let reports: EspionageBrief[];
    let reportList = this.parser.parseReportList(await this.getListResponse());
    this.lastToken = reportList.token;
    reports = reportList.reports;
    while (reportList.page < reportList.totalPages) {
      reportList = this.parser.parseReportList(await this.getPageResponse(reportList.page + 1));
      this.lastToken = reportList.token;
      reports = reports.concat(reportList.reports);
    }
    reports = deduplicate(reports, (a, b) => b.header.id - a.header.id);
    return {
      token: this.lastToken,
      page: 1,
      totalPages: 1,
      reports
    };
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

  async getPageResponse(page: number): Promise<string> {
    let response = await this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      method: 'POST',
      query: {
        page: 'messages'
      },
      body: {
        messageId: -1,
        tabid: 20,
        action: 107,
        pagination: page,
        ajax: 1,
        token: this.lastToken,
        standalonePage: 0
      }
    });
    return response.text();
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

  async loadAllReports(clean: boolean = true): Promise<StampedEspionageReport[]> {
    const reportList = await this.loadReportList();
    const result: StampedEspionageReport[] = [];
    this.loadingQueue = reportList.reports;
    while (this.loadingQueue.length) {
      const brief = this.loadingQueue.shift()!;
      const id = brief.header.id;
      if (brief.isCounterEspionage) {
        if (clean) await this.deleteReport(id);
      } else {
        const report = await this.loadReport(id);
        if (report) {
          result.push(report);
          await this.repo.store(report);
          if (clean) await this.deleteReport(id);
        }
      }
    }
    return result;
  }
}
