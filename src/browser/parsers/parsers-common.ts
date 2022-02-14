import {Coordinates} from '../../common/types';

export function parseOnlyNumbers(text: string): number {
  return +text.replace(/[\D]/g, '');
}

export function parseLocalDate(text: string): Date {
  let parsed = /^(\d{1,2})\.(\d{1,2})\.(\d{1,4})\s(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(text);
  if (!parsed) throw new Error(`unparseable date: ${text}`);
  let [day, month, year, hour, minute, second] = parsed.slice(1).map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
}

export function parseCoordinates(value: string): Coordinates | null {
  let parsed = /^\[(\d+):(\d+):(\d+)]$/.exec(value);
  return parsed && {
    galaxy: +parsed[1],
    system: +parsed[2],
    position: +parsed[3]
  };
}

export function readAttribute(body: string, position: number): string {
  let start = body.indexOf('"', position) + 1;
  let end = body.indexOf('"', start);
  return body.substring(start, end).trim();
}
