import {JSDOM} from 'jsdom';
import request from 'request';
import {Cookie, CookieJar, MemoryCookieStore} from 'tough-cookie';
import {CoordinateType, Mission, ShipType, ShipTypeId, StampedEspionageReport} from '../model/types';
import {parseReport, parseReportList} from '../parsers/espionage-reports';
import {FlightEvent, parseEventList} from '../parsers/event-list';
import {GalaxySystemInfo, parseGalaxy} from '../parsers/galaxy-reports';
import {EspionageRepository} from '../repository/EspionageRepository';
import {GalaxyRepository} from '../repository/GalaxyRepository';

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
      GalaxyRepository.instance.findNextStale(
          params.galaxyMin, params.galaxyMax, params.systemMin, params.systemMax, params.galaxyLast, params.systemLast,
          params.normalTimeout, params.emptyTimeout
      ).then(nextTarget => {
        if (!nextTarget) {
          params.galaxyLast = null;
          params.systemLast = null;
        } else {
          let galaxyNext: number = nextTarget.galaxy;
          let systemNext: number = nextTarget.system;
          this.viewGalaxy(galaxyNext, systemNext).then(result => {
            GalaxyRepository.instance.store(result).then(() => {
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
        return EspionageRepository.instance.store(report).then(() => {
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

  loadEvents(): Promise<FlightEvent[]> {
    return Mapper.asPromise({
      uri: Mapper.GAME_URL,
      qs: {
        page: 'eventList',
        ajax: 1
      },
      jar: this.requestJar
    }, false).then(response => {
      return parseEventList(JSDOM.fragment(response.body));
    });
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
    }, true);
  }

  private fleetStep2(form: Form, mission: Mission): Promise<request.Response> {
    for (let key in mission.fleet) {
      let shipType = key as ShipType;
      form[ShipTypeId[shipType]] = mission.fleet[shipType];
    }

    return Mapper.asPromise({
      uri: Mapper.GAME_URL,
      method: 'POST',
      qs: {page: 'fleet2'},
      form: form,
      jar: this.requestJar
    }, true);
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
    }, true);
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
