import {ReplyingMessageChannel} from '../message/ReplyingMessageChannel';
import {AutoObserveSettings, AutoObserveState, Status} from '../services/AutoObserve';
import {SystemCoordinates} from '../types';
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
  getStatus(): Promise<Status> {
    return remoteGet(this.channel, ['status']);
  }
  getScheduledContinue(): Promise<Date | undefined> {
    return remoteGet(this.channel, ['scheduledContinue']);
  }
  getQueue(): Promise<SystemCoordinates[]> {
    return remoteGet(this.channel, ['queue']);
  }
  getInProgress(): Promise<SystemCoordinates[]> {
    return remoteGet(this.channel, ['inProgress']);
  }

  pause(): Promise<AutoObserveState> {
    return remoteInvoke(this.channel, ['pause']);
  }
  continue(): Promise<AutoObserveState> {
    return remoteInvoke(this.channel, ['continue']);
  }
  enqueue(...systems: SystemCoordinates[]): Promise<AutoObserveState> {
    return remoteInvoke(this.channel, ['enqueue'], ...systems);
  }
}
