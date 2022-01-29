import {JSDOM} from 'jsdom';
import * as request from 'request';
import {Cookie, CookieJar, MemoryCookieStore} from 'tough-cookie';
import {parseEventList} from '../browser/parsers/event-list';
import {FlightEvent, Mapper} from '../common/report-types';
import {GalaxyRepository} from '../common/repository-types';
import {CoordinateType, Mission, ShipType, ShipTypeId} from '../common/types';
import {dumpFile} from '../standalone/files';

type Form = { [key: string]: string | number };

export interface Fetcher {
  fetch(options: RequestOptions, firstByteOnly?: boolean): Promise<request.Response>;
}

export interface RequestOptions {
  url: string;
  method?: string;
  query?: any;
  body?: any;
  headers?: { [name: string]: string };
  redirect?: boolean;
}

export class LegacyMapper implements Mapper {
  static readonly LOBBY_DOMAIN_URL = 'lobby-api.ogame.gameforge.com';
  static readonly LOBBY_LOGIN_URL = 'https://' + LegacyMapper.LOBBY_DOMAIN_URL + '/users';
  static readonly GAME_DOMAIN = 's148-ru.ogame.gameforge.com';
  static readonly GAME_URL = 'https://' + LegacyMapper.GAME_DOMAIN + '/game/index.php';
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

  jar: CookieJar;
  requestJar: request.CookieJar;

  constructor(private galaxyRepo: GalaxyRepository,
              private fetcher: Fetcher) {
    const cookieStore = new MemoryCookieStore();
    this.jar = new CookieJar(cookieStore);
    this.requestJar = request.jar(cookieStore);
    request.defaults({
      jar: this.requestJar
    });
  }

  useCookie(cookieString: string | string[], url: string = LegacyMapper.GAME_DOMAIN) {
    // TODO this is related only to cookieJar and legacy fetcher; should move this there
    if (typeof (cookieString) === 'string')
      cookieString = [cookieString];
    if (cookieString) {
      for (let item of cookieString) {
        let cookies = item.split(/;\s*/);
        for (let cookie of cookies) {
          let parsed = Cookie.parse(cookie);
          if (parsed && !LegacyMapper.blacklistCookie[parsed.key]) {
            this.requestJar.setCookie(cookie, url);
          }
        }
      }
    }
  }

  ping(): Promise<request.Response> {
    return this.fetcher.fetch({
      url: LegacyMapper.GAME_URL,
      method: 'GET',
      redirect: false
    });
  }


  loadEvents(): Promise<FlightEvent[]> {
    return this.fetcher.fetch({
      url: LegacyMapper.GAME_URL,
      query: {
        page: 'eventList',
        ajax: 1
      }
    }).then(response => {
      try {
        return parseEventList(JSDOM.fragment(response.body));
      } catch (ex) {
        dumpFile(`../../etc/samples/auto/events-${Date.now()}.html`, response.body);
        return Promise.reject(ex);
      }
    });
  }

  launch(mission: Mission): Promise<number> {
    const form: Form = {};
    return this.fleetStep1(mission)
        .then(() => this.fleetStep2(form, mission))
        .then(() => this.fleetStep3(form, mission))
        .then(step3 => {
          let document = new JSDOM(step3.body).window.document;
          let token = document.querySelector('input[name="token"]')!.getAttribute('value')!;
          return this.fleetStepCommit(form, mission, token);
        })
        .then(response => response.statusCode); // TODO return fleet id
  }

  private fleetStep1(mission: Mission): Promise<request.Response> {
    let queryParams: any = {page: 'fleet1'};
    if (mission.from)
      queryParams.cp = mission.from;
    return this.fetcher.fetch({
      url: LegacyMapper.GAME_URL,
      method: 'GET',
      query: queryParams
    }, true);
  }

  private fleetStep2(form: Form, mission: Mission): Promise<request.Response> {
    for (let key in mission.fleet) {
      let shipType = key as ShipType;
      form[ShipTypeId[shipType]] = mission.fleet[shipType]!;
    }

    return this.fetcher.fetch({
      url: LegacyMapper.GAME_URL,
      method: 'POST',
      query: {page: 'fleet2'},
      body: form
    }, true);
  }

  private fleetStep3(form: Form, mission: Mission): Promise<request.Response> {
    form['galaxy'] = mission.to.galaxy;
    form['system'] = mission.to.system;
    form['position'] = mission.to.position;
    form['type'] = mission.to.type || CoordinateType.Planet;
    form['speed'] = mission.speed || 10;

    return this.fetcher.fetch({
      url: LegacyMapper.GAME_URL,
      method: 'POST',
      query: {page: 'fleet3'},
      body: form
    });
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

    return this.fetcher.fetch({
      url: LegacyMapper.GAME_URL,
      method: 'POST',
      query: form,
      body: {token: token}
    }, true);
  }

  loginLobby(): Promise<string> {
    return this.fetcher.fetch({
      url: LegacyMapper.LOBBY_LOGIN_URL,
      method: 'POST',
      body: {
        'credentials[email]': 'vasily.liaskovsky@gmail.com',
        'credentials[password]': 'LemKoTir',
        autologin: false,
        language: 'ru',
        kid: ''
      }
    }).then(() =>
        this.fetcher.fetch({
          url: 'https://lobby-api.ogame.gameforge.com/users/me/loginLink?id=101497&server[language]=ru&server[number]=148',
          json: true
        } as RequestOptions))
        .then(response => response.body['url'] as string)
        .then(url => this.fetcher.fetch({url: url}))
        .then(response => {
          console.log(response.body.length);
          return 'ok';
        });
  }
}
