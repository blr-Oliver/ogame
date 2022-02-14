import {JSDOM} from 'jsdom';
import {parseEventList} from '../browser/parsers/dom/event-list-dom';
import {Fetcher, ResponseFacade} from '../common/core/Fetcher';
import {ServerContext} from '../common/core/ServerContext';
import {FlightEvent} from '../common/report-types';
import {Mapper} from '../common/services/Mapper';
import {CoordinateType, Mission, ShipType, ShipTypeId} from '../common/types';
import {dumpFile} from '../standalone/files';

type Form = { [key: string]: string | number };

export class LegacyMapper implements Mapper {
  constructor(private fetcher: Fetcher,
              private serverContext: ServerContext) {
  }

  ping(): Promise<ResponseFacade> {
    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      method: 'GET',
      redirect: false
    });
  }

  loadEvents(): Promise<FlightEvent[]> {
    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      query: {
        page: 'eventList',
        ajax: 1
      }
    })
        .then(response => response.text())
        .then(body => {
          try {
            return parseEventList(JSDOM.fragment(body));
          } catch (ex) {
            dumpFile(`../../etc/samples/auto/events-${Date.now()}.html`, body);
            return Promise.reject(ex);
          }
        });
  }

  launch(mission: Mission): Promise<any> {
    const form: Form = {};
    return this.fleetStep1(mission)
        .then(() => this.fleetStep2(form, mission))
        .then(() => this.fleetStep3(form, mission))
        .then(step3 => step3.text())
        .then(body => {
          let document = new JSDOM(body).window.document;
          let token = document.querySelector('input[name="token"]')!.getAttribute('value')!;
          return this.fleetStepCommit(form, mission, token);
        });// TODO return fleet id
  }

  private fleetStep1(mission: Mission): Promise<ResponseFacade> {
    let queryParams: any = {page: 'fleet1'};
    if (mission.from)
      queryParams.cp = mission.from;
    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      method: 'GET',
      query: queryParams
    }, true);
  }

  private fleetStep2(form: Form, mission: Mission): Promise<ResponseFacade> {
    for (let key in mission.fleet) {
      let shipType = key as ShipType;
      form[`am${ShipTypeId[shipType]}`] = mission.fleet[shipType]!;
    }

    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      method: 'POST',
      query: {page: 'fleet2'},
      body: form
    }, true);
  }

  private fleetStep3(form: Form, mission: Mission): Promise<ResponseFacade> {
    form['galaxy'] = mission.to.galaxy;
    form['system'] = mission.to.system;
    form['position'] = mission.to.position;
    form['type'] = mission.to.type || CoordinateType.Planet;
    form['speed'] = mission.speed || 10;

    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
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
      form['deuterium'] = mission.cargo.deuterium || 0;
    }

    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      method: 'POST',
      query: form,
      body: {token: token}
    }, true);
  }

  loginLobby(): Promise<string> {
    return this.fetcher.fetch({
      url: this.serverContext.lobbyLoginUrl,
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
          url: 'https://lobby-api.ogame.gameforge.com/users/me/loginLink?id=101497&server[language]=ru&server[number]=148'
        }))
        .then(response => response.json())
        .then(json => json['url'] as string)
        .then(url => this.fetcher.fetch({url: url}))
        .then(login => 'ok');
  }
}
