import {ReplyingMessageChannel} from '../message/ReplyingMessageChannel';
import {AutoObserveSettings, AutoObserveState, AutoObserveStatus} from '../services/AutoObserve';
import {RemoteAutoObserve, RemoteAutoObserveSettings} from './RemoteAutoObserve';
import {remoteAssign, remoteGet, remoteInvoke, remoteSet} from './stub-skeleton';

class AutoObserveSettingsStub implements RemoteAutoObserveSettings {
  constructor(private readonly port: ReplyingMessageChannel) {
  }
  get(): Promise<AutoObserveSettings> {
    return remoteGet(this.port, ['settings']);
  }
  set(settings: Partial<AutoObserveSettings>): Promise<AutoObserveSettings> {
    return remoteAssign(this.port, ['settings'], settings);
  }
  getDelay(): Promise<number> {
    return remoteGet(this.port, ['settings', 'delay']);
  }
  getTimeout(): Promise<number> {
    return remoteGet(this.port, ['settings', 'timeout']);
  }
  getEmptyTimeout(): Promise<number> {
    return remoteGet(this.port, ['settings', 'emptyTimeout']);
  }
  setDelay(value: number): Promise<void> {
    return remoteSet(this.port, ['settings', 'delay'], value);
  }
  setEmptyTimeout(value: number): Promise<void> {
    return remoteSet(this.port, ['settings', 'timeout'], value);
  }
  setTimeout(value: number): Promise<void> {
    return remoteSet(this.port, ['settings', 'timeout'], value);
  }
}

export class AutoObserveStub implements RemoteAutoObserve {
  readonly settings: RemoteAutoObserveSettings;
  constructor(private readonly channel: ReplyingMessageChannel) {
    this.settings = new AutoObserveSettingsStub(channel);
  }
  get(): Promise<AutoObserveState> {
    return remoteGet(this.channel, []);
  }
  getStatus(): Promise<AutoObserveStatus> {
    return remoteGet(this.channel, ['status']);
  }
  getNextWakeUp(): Promise<Date | undefined> {
    return remoteGet(this.channel, ['nextWakeUp']);
  }
  pause(): Promise<AutoObserveState> {
    return remoteInvoke(this.channel, ['pause']);
  }
  continue(): Promise<AutoObserveState> {
    return remoteInvoke(this.channel, ['continue']);
  }
}
