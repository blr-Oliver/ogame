import {SystemCoordinates} from '../core/types/core';

export type AutoObserveStatus = 'paused' | 'idle' | 'active' | 'sleeping';

export interface AutoObserveSettings {
  delay: number;
  timeout: number;
  emptyTimeout: number;
}

export interface AutoObserveState {
  readonly status: AutoObserveStatus;
  readonly nextWakeUp?: Date;
  readonly settings: AutoObserveSettings;
}

export interface AutoObserve extends AutoObserveState {
  pause(): void;
  continue(): void;
  enqueue(...systems: SystemCoordinates[]): void;
}

