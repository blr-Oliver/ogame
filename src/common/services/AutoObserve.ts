import {SystemCoordinates} from '../types';

export type Status = 'paused' | 'idle' | 'active';

export interface AutoObserveSettings {
  delay: number;
  timeout: number;
  emptyTimeout: number;
}

export interface AutoObserveState {
  readonly status: Status;
  readonly scheduledContinue?: Date;
  readonly queue: SystemCoordinates[];
  readonly inProgress: SystemCoordinates[];
  readonly settings: AutoObserveSettings;
}

export interface AutoObserve extends AutoObserveState {
  pause(): void;
  continue(): void;
  enqueue(...systems: SystemCoordinates[]): void;
}

