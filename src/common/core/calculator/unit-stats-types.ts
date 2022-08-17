import {DefenseType, ResearchType, Resources, ShipType} from '../../types';
import * as DEFENCE_STATS_RAW from './defence-stats.json';
import * as SHIP_STATS_RAW from './ship-stats.json';

export type UnitType = ShipType | DefenseType;
export type RapidFireTable = { [key in UnitType]?: number };
export const SHIP_STATS: { [key in ShipType]: ShipStats } = SHIP_STATS_RAW;
export const DEFENCE_STATS: { [key in DefenseType]: DefenceStats } = DEFENCE_STATS_RAW;

export enum Drive {
  combustion = 1,
  impulse = 2,
  hyperspace = 3
}

export type DriveName = keyof typeof Drive;
export type UnitDrive = {
  [drive in DriveName]?: number
}
export type UnitConsumption = {
  [drive in DriveName]?: number
}
export type UnitSpeed = {
  [drive in DriveName]?: number
}

export interface UnitStats {
  cost: Resources,
  shield: number;
  attack: number;
  rapidFire: RapidFireTable;
}

export interface DefenceStats extends UnitStats {
}

export interface ShipStats extends UnitStats {
  capacity: number;
  drive: UnitDrive;
  consumption: UnitConsumption;
  speed: UnitSpeed;
}

export const DRIVE_TECH: { [drive in DriveName]: ResearchType } = {
  combustion: 'combustionDrive',
  impulse: 'impulseDrive',
  hyperspace: 'hyperspaceDrive'
};
