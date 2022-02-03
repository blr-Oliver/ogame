import {SystemCoordinates} from '../types';
import {AutoObserveSettings, AutoObserveState, Status} from './AutoObserve';

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

  getStatus(): Promise<Status>;
  getScheduledContinue(): Promise<Date | undefined>;
  getQueue(): Promise<SystemCoordinates[]>;
  readonly settings: RemoteAutoObserveSettings;

  pause(): Promise<AutoObserveState>;
  continue(): Promise<AutoObserveState>;
  enqueue(...systems: SystemCoordinates[]): Promise<AutoObserveState>;
}
