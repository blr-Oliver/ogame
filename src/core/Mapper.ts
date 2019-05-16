import {JSDOM} from 'jsdom';
import request from 'request';
import {Cookie, CookieJar, MemoryCookieStore} from 'tough-cookie';
import {db} from '../display/db';
import {storeGalaxy} from '../display/display-galaxy';
import {storeReport} from '../display/display-report';
import {CoordinateType, FleetType, Mission, StampedEspionageReport} from '../model/types';
import {parseReport, parseReportList} from '../parsers/espionage-reports';
import {GalaxySystemInfo, parseGalaxy} from '../parsers/galaxy-reports';

type Form = { [key: string]: string | number };

export interface ObserveParams {
  pause: boolean;
  galaxyMin: number;
  galaxyMax: number;
  galaxyLast: number;
  systemMin: number;
  systemMax: number;
  systemLast: number;
  emptyTimeout: number;
  normalTimeout: number;
}

export class Mapper {
  static readonly LOBBY_DOMAIN_URL = 'lobby-api.ogame.gameforge.com';
  static readonly LOBBY_LOGIN_URL = 'https://' + Mapper.LOBBY_DOMAIN_URL + '/users';
  static readonly GAME_DOMAIN = 's148-ru.ogame.gameforge.com';
  static readonly GAME_URL = 'https://' + Mapper.GAME_DOMAIN + '/game/index.php';
  static blacklistCookie: { [key: string]: boolean } = {
    tabBoxFleets: true,
    visibleChats: true,
    maximizeId: true,
    __auc: true,
    __asc: true,
    _ga: true,
    _gid: true,
    _fbp: true
  };
  static instance: Mapper = new Mapper();

  jar: CookieJar;
  requestJar: request.CookieJar;

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

  private observeNext: NodeJS.Timeout = null;
  private reportNext: NodeJS.Timeout = null;

  reportIdList: number[] = [];
  lastReportId: number = null;

  constructor() {
    const cookieStore = new MemoryCookieStore();
    this.jar = new CookieJar(cookieStore);
    this.requestJar = request.jar(cookieStore);
    request.defaults({
      jar: this.requestJar
    });
  }

  useCookie(cookieString: string | string[], url: string = Mapper.GAME_DOMAIN) {
    if (typeof (cookieString) === 'string')
      cookieString = [cookieString];
    if (cookieString) {
      for (let item of cookieString) {
        let cookies = item.split(/;\s*/);
        for (let cookie of cookies) {
          let parsed = Cookie.parse(cookie);
          if (!Mapper.blacklistCookie[parsed.key]) {
            this.requestJar.setCookie(cookie, url);
          }
        }
      }
    }
  }

  ping(): Promise<request.Response> {
    return Mapper.asPromise({
      uri: Mapper.GAME_URL,
      method: 'GET',
      jar: this.requestJar,
      followRedirect: false
    });
  }

  viewGalaxy(galaxy: number, system: number): Promise<GalaxySystemInfo> {
    return Mapper.asPromise({
      uri: Mapper.GAME_URL,
      method: 'POST',
      json: true,
      qs: {
        page: 'galaxyContent',
        ajax: 1
      },
      form: {
        galaxy: galaxy,
        system: system
      },
      jar: this.requestJar
    }).then(galaxyResponse => {
      let timestamp: Date = galaxyResponse.headers.date ? new Date(galaxyResponse.headers.date) : new Date();
      let galaxyResult = parseGalaxy(JSDOM.fragment(galaxyResponse.body['galaxy']));
      galaxyResult.timestamp = timestamp;
      return galaxyResult;
    });
  }

  continueObserve() {
    const params = this.observe;
    if (this.observeNext) {
      clearTimeout(this.observeNext);
      this.observeNext = null;
    }
    if (!params.pause) {
      params.pause = true;
      db.query({
        sql:
            `select galaxy, system from galaxy_report where
              galaxy >= ${params.galaxyMin} and galaxy <= ${params.galaxyMax} and system >= ${params.systemMin} and system <= ${params.systemMax}
              and (galaxy = ${params.galaxyLast} and system > ${params.systemLast} or galaxy > ${params.galaxyLast || 0})
              and (empty = 1 and timestamp < date_sub(now(), interval ${params.emptyTimeout} second) 
                   or empty = 0 and timestamp < date_sub(now(), interval ${params.normalTimeout} second))
              order by galaxy asc, system asc
              limit 1;`
      }).then((rows: any[]) => {
        if (!rows.length) return null;
        return [rows[0].galaxy, rows[0].system];
      }).then(nextTarget => {
        if (!nextTarget) {
          params.galaxyLast = null;
          params.systemLast = null;
        } else {
          let galaxyNext: number = nextTarget[0];
          let systemNext: number = nextTarget[1];
          this.viewGalaxy(galaxyNext, systemNext).then(result => {
            storeGalaxy(result).then(() => {
              params.pause = false;
              params.galaxyLast = galaxyNext;
              params.systemLast = systemNext;
              this.observeNext = setTimeout(() => this.continueObserve(), 0);
            });
          });
        }
      })
    }
  }

  loadReportList(): Promise<number[]> {
    return Mapper.asPromise({
      uri: Mapper.GAME_URL,
      method: 'GET',
      qs: {
        page: 'messages',
        tab: 20,
        ajax: 1
      },
      jar: this.requestJar
    }).then(response => {
      return parseReportList(JSDOM.fragment(response.body));
    }).then(idList => {
      return idList.sort();
    });
  }

  continueLoadReports() {
    if (this.reportNext) {
      clearTimeout(this.reportNext);
      this.reportNext = null;
    }

    if (this.reportIdList && this.reportIdList.length) {
      this.loadReport(this.reportIdList[0]).then(report => {
        return storeReport(report).then(() => {
          this.lastReportId = this.reportIdList.shift();
          this.reportNext = setTimeout(() => this.continueLoadReports(), 500 + Math.floor(Math.random() * 500));
          return report.id;
        });
      }).then(reportId => {
        // removing report, ignoring response
        request({
          uri: Mapper.GAME_URL,
          method: 'POST',
          qs: {
            page: 'messages'
          },
          form: {
            messageId: reportId,
            action: 103,
            ajax: 1
          },
          jar: this.requestJar
        });
      });
    } else {
      this.loadReportList().then(idList => {
        this.reportIdList = idList;
        if (idList && idList.length)
          this.reportNext = setTimeout(() => this.continueLoadReports(), 500 + Math.floor(Math.random() * 500));
      })
    }
  }

  loadReport(id: number): Promise<StampedEspionageReport> {
    return Mapper.asPromise({
      uri: Mapper.GAME_URL,
      qs: {
        page: 'messages',
        messageId: id,
        tabid: 20,
        ajax: 1
      },
      jar: this.requestJar
    }).then(response => {
      return parseReport(JSDOM.fragment(response.body));
    });
  }

  launch(mission: Mission): Promise<any> {
    const form: Form = {};
    return this.fleetStep1(mission)
        .then(() => {
          return this.fleetStep2(form, mission);
        })
        .then(() => {
          return this.fleetStep3(form, mission)
        })
        .then(step3 => {
          let document = new JSDOM(step3.body).window.document;
          let token = document.querySelector('input[name="token"]').getAttribute('value');
          return this.fleetStepCommit(form, mission, token);
        })
        .then(response => response.statusCode); // TODO return fleet id
  }


  private fleetStep1(mission: Mission): Promise<request.Response> {
    let queryParams: any = {page: 'fleet1'};
    if (mission.from)
      queryParams.cp = mission.from;
    return Mapper.asPromise({
      uri: Mapper.GAME_URL,
      method: 'GET',
      qs: queryParams,
      jar: this.requestJar
    }, false);
  }

  private fleetStep2(form: Form, mission: Mission): Promise<request.Response> {
    for (let shipKey in mission.fleet)
      form[shipKey] = mission.fleet[shipKey as FleetType];

    return Mapper.asPromise({
      uri: Mapper.GAME_URL,
      method: 'POST',
      qs: {page: 'fleet2'},
      form: form,
      jar: this.requestJar
    }, false);
  }

  private fleetStep3(form: Form, mission: Mission): Promise<request.Response> {
    form['galaxy'] = mission.to.galaxy;
    form['system'] = mission.to.system;
    form['position'] = mission.to.position;
    form['type'] = mission.to.type || CoordinateType.Planet;
    form['speed'] = mission.speed || 10;

    return Mapper.asPromise({
      uri: Mapper.GAME_URL,
      method: 'POST',
      qs: {page: 'fleet3'},
      form: form,
      jar: this.requestJar
    }, false);
  }

  private fleetStepCommit(form: Form, mission: Mission, token: string) {
    form['mission'] = mission.mission;
    form['token'] = token;
    form['page'] = 'movement';
    form['ajax'] = 1;

    if (mission.cargo) {
      form['metal'] = mission.cargo.metal || 0;
      form['crystal'] = mission.cargo.crystal || 0;
      form['deuterium'] = mission.cargo.deut || 0;
    }

    return Mapper.asPromise({
      uri: Mapper.GAME_URL,
      method: 'POST',
      qs: form,
      form: {token: token},
      jar: this.requestJar
    }, false);
  }

  loginLobby(): Promise<string> {
    return Mapper.asPromise({
      uri: Mapper.LOBBY_LOGIN_URL,
      method: 'POST',
      jar: this.requestJar,
      form: {
        'credentials[email]': 'vasily.liaskovsky@gmail.com',
        'credentials[password]': 'LemKoTir',
        autologin: false,
        language: 'ru',
        kid: ''
      }
    }).then(() => {
      return Mapper.asPromise({
        uri: 'https://lobby-api.ogame.gameforge.com/users/me/loginLink?id=101497&server[language]=ru&server[number]=148',
        jar: this.requestJar,
        json: true
      }).then(response => response.body['url']);
    }).then(url => {
      return Mapper.asPromise({
        uri: url,
        jar: this.requestJar
      }).then(response => {
        console.log(response.body.length);
        return 'ok';
      });
    });
  }

  private static asPromise(options: request.Options, firstByteOnly = false): Promise<request.Response> {
    if (firstByteOnly)
      return new Promise((resolve, reject) => {
        let req = request(options);
        req.on('response', response => {
          req.destroy();
          resolve(response);
        });
        req.on('error', reject);
      });
    else
      return new Promise((resolve, reject) => {
        request(options, (error, response) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
  }
}

/*
DELETE r FROM espionage_report r
        JOIN
    espionage_report other ON r.galaxy = other.galaxy
        AND r.system = other.system
        AND r.position = other.position
        AND r.type = other.type
        AND r.info_level <= other.info_level
        AND r.timestamp < other.timestamp;
 */
