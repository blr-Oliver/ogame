import {Fetcher, ResponseFacade} from '../core/Fetcher';
import {ServerContext} from '../core/ServerContext';
import {CoordinateType, Mission, ShipType, ShipTypeId} from '../types';
import {Launcher} from './Mapper';

export class TwoStepLauncher implements Launcher {
  static readonly #ACTION_CHECK_TARGET = 'checkTarget';
  static readonly #ACTION_SEND_FLEET = 'sendFleet';
  static readonly #BASE_QUERY: { [param: string]: string | number } = {
    page: 'ingame',
    component: 'fleetdispatch',
    action: 'checkTarget',
    ajax: 1,
    asJson: 1
  };
  static readonly #BASE_HEADERS: { [name: string]: string } = {
    'X-Requested-With': 'XMLHttpRequest'
  };

  private lastToken?: string;

  constructor(
      private readonly serverContext: ServerContext,
      private readonly fetcher: Fetcher) {
  }

  async launch(mission: Mission): Promise<unknown> {
    const body = this.prepareBody(mission);
    let checkResponse = await this.doSend(TwoStepLauncher.#ACTION_CHECK_TARGET, body);
    let checkData = await checkResponse.json();
    body['token'] = this.lastToken = checkData['newAjaxToken'];
    return this.doSend(TwoStepLauncher.#ACTION_SEND_FLEET, body);
  }

  private doSend(action: string, body: { [p: string]: number | string }): Promise<ResponseFacade> {
    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      method: 'POST',
      query: {
        ...TwoStepLauncher.#BASE_QUERY,
        action: action
      },
      body: body,
      headers: TwoStepLauncher.#BASE_HEADERS
    });
  }

  private prepareBody(mission: Mission): { [param: string]: number | string } {
    let body: { [param: string]: number | string } = {};
    if (this.lastToken) body['token'] = this.lastToken;
    if (mission.from) body['cp'] = mission.from;
    Object.assign(body, mission.to);
    if (!('type' in body)) body['type'] = CoordinateType.Planet;
    for (let key in mission.fleet) {
      const shipName: ShipType = key as ShipType;
      body[`am${ShipTypeId[shipName]}`] = mission.fleet[shipName]!;
    }
    body['mission'] = mission.mission;
    body['speed'] = mission.speed || 10;
    if (mission.cargo) Object.assign(body, mission.cargo);
    if (mission.holdTime) body['holdingtime'] = mission.holdTime;
    return body;
  }
}
