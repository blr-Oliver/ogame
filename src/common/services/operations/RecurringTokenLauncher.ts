import {sleep} from '../../common';
import {Fetcher, ResponseFacade} from '../../core/Fetcher';
import {ServerContext} from '../../core/ServerContext';
import {CoordinateType, Mission, ShipType, ShipTypeId} from '../../types';
import {Launcher} from '../Mapper';

interface LaunchTask {
  maxAttempts?: number;
  mission: Mission;
  resolve: (x: any) => void;
  reject: (e: any) => void;
}

export class RecurringTokenLauncher implements Launcher {
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

  private queue: LaunchTask[] = [];
  private processing: boolean = false;
  private token: string = '01234567012345670123456701234567';

  constructor(
      private readonly serverContext: ServerContext,
      private readonly fetcher: Fetcher) {
  }

  launch(mission: Mission, maxAttempts: number = 3): Promise<unknown> {
    console.debug(`TwoStepLauncher#launch()`, mission);
    return new Promise((resolve, reject) => {
      this.queue.push({mission, resolve, reject, maxAttempts});
      this.continueProcessing();
    });
  }

  private async continueProcessing() {
    if (!this.processing)
      if (this.queue.length) {
        this.processing = true;
        while (this.queue.length) {
          await this.processTask(this.queue.shift()!);
          await sleep(100);
        }
        this.processing = false;
      }
  }

  private async processTask(task: LaunchTask): Promise<void> {
    // console.debug(`TwoStepLauncher#processTask(): starting`, task.mission);
    const body = this.prepareBody(task.mission);
    let attemptsLeft = task.maxAttempts || 3;
    let delay = 0;
    while (attemptsLeft > 0) {
      delay && await sleep(delay);
      body['token'] = this.token;
      let response = await this.doSend(RecurringTokenLauncher.#ACTION_SEND_FLEET, body);
      let responseData = await response.json();
      --attemptsLeft;
      this.token = responseData['newAjaxToken'];
      if (responseData['success']) {
        task.resolve(void 0);
        return;
      } else {
        console.debug(`TwoStepLauncher#processTask(): attempts left: ${attemptsLeft}, response data:`, responseData);
        delay += 100;
      }
    }
    task.reject('too many attempts failed');
  }

  private doSend(action: string, body: { [p: string]: number | string }): Promise<ResponseFacade> {
    return this.fetcher.fetch({
      url: this.serverContext.gameUrl,
      method: 'POST',
      query: {
        ...RecurringTokenLauncher.#BASE_QUERY,
        action: action
      },
      body: body,
      headers: RecurringTokenLauncher.#BASE_HEADERS
    });
  }

  private prepareBody(mission: Mission): { [param: string]: number | string } {
    let body: { [param: string]: number | string } = {};
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
    if (mission.priority) {
      body['prioMetal'] = mission.priority.metal;
      body['prioCrystal'] = mission.priority.crystal;
      body['prioDeuterium'] = mission.priority.deuterium;
    }
    if (mission.holdTime) body['holdingtime'] = mission.holdTime;
    return body;
  }
}
