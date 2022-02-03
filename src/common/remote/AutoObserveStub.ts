import {ReplyingMessagePort} from '../message/ReplyingMessagePort';
import {AutoObserveSettings, AutoObserveState, Status} from '../services/AutoObserve';
import {SystemCoordinates} from '../types';
import {RemoteAutoObserve, RemoteAutoObserveSettings} from './RemoteAutoObserve';
import {remoteAssign, remoteGet, remoteInvoke, remoteSet} from './stub-skeleton';

class AutoObserveSettingsStub implements RemoteAutoObserveSettings {
  constructor(private readonly port: ReplyingMessagePort) {
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
  constructor(private readonly port: ReplyingMessagePort) {
    this.settings = new AutoObserveSettingsStub(port);
  }
  get(): Promise<AutoObserveState> {
    return remoteGet(this.port, ['.']);
  }
  getStatus(): Promise<Status> {
    return remoteGet(this.port, ['status']);
  }
  getScheduledContinue(): Promise<Date | undefined> {
    return remoteGet(this.port, ['scheduledContinue']);
  }
  getQueue(): Promise<SystemCoordinates[]> {
    return remoteGet(this.port, ['queue']);
  }
  getInProgress(): Promise<SystemCoordinates[]> {
    return remoteGet(this.port, ['inProgress']);
  }

  pause(): Promise<AutoObserveState> {
    return remoteInvoke(this.port, ['pause']);
  }
  continue(): Promise<AutoObserveState> {
    return remoteInvoke(this.port, ['continue']);
  }
  enqueue(...systems: SystemCoordinates[]): Promise<AutoObserveState> {
    return remoteInvoke(this.port, ['enqueue'], ...systems);
  }
}
