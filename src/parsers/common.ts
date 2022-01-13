import {Coordinates} from '../model/types';

export function parseOnlyNumbers(text: string): number {
  return +text.replace(/[\D]/g, '');
}

export function parseLocalDate(text: string): Date {
  let parsed = /^(\d{1,2})\.(\d{1,2})\.(\d{1,4})\s(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(text);
  if (!parsed) throw new Error(`unparseable date: ${text}`);
  let [day, month, year, hour, minute, second] = parsed.slice(1).map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
}

export function valueToSQLString(value: string | number | Date | boolean | undefined | null): string {
  if (typeof (value) === 'number') return String(value);
  if (typeof (value) === 'string') return `'${value}'`;
  if (typeof (value) === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `FROM_UNIXTIME(${value.getTime()} * 0.001)`;
  return 'NULL';
}

export function parseCoordinates(value: string): Coordinates | null {
  let parsed = /^\[(\d+):(\d+):(\d+)]$/.exec(value);
  return parsed && {
    galaxy: +parsed[1],
    system: +parsed[2],
    position: +parsed[3]
  };
}

export const map: <T, U, A extends ArrayLike<T> | T[]>(array: A, callback: (value: T, index: number, array: A) => U, thisArg?: any) => U[] =
    Function.prototype.call.bind(Array.prototype.map);
