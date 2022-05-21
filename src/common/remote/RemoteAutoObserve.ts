import {AutoObserveSettings, AutoObserveState, AutoObserveStatus} from '../services/AutoObserve';

export interface RemoteAutoObserveSettings {
  get(): Promise<AutoObserveSettings>;
  set(settings: Partial<AutoObserveSettings>): Promise<AutoObserveSettings>;

  getDelay(): Promise<number>;
  setDelay(value: number): Promise<void>;
  getTimeout(): Promise<number>;
  setTimeout(value: number): Promise<void>;
  getEmptyTimeout(): Promise<number>;
  setEmptyTimeout(value: number): Promise<void>;
}

export interface RemoteAutoObserve {
  get(): Promise<AutoObserveState>;

  getStatus(): Promise<AutoObserveStatus>;
  getNextWakeUp(): Promise<Date | undefined>;
  readonly settings: RemoteAutoObserveSettings;

  pause(): Promise<AutoObserveState>;
  continue(): Promise<AutoObserveState>;
}
