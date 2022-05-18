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
  /**
   * @deprecated
   */
  readonly queue?: SystemCoordinates[];
  /**
   * @deprecated
   */
  readonly inProgress?: SystemCoordinates[];
  readonly settings: AutoObserveSettings;
}

export interface AutoObserve extends AutoObserveState {
  pause(): void;
  continue(): void;
  /**
   * @deprecated
   */
  enqueue(...systems: SystemCoordinates[]): void;
}

