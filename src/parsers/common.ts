export function parseOnlyNumbers(text: string): number {
  return +text.replace(/[\D]/g, '');
}

export function parseLocalDate(text: string): Date {
  let [day, month, year, hour, minute, second] = /^(\d{1,2})\.(\d{1,2})\.(\d{1,4})\s(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(text).slice(1).map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
}

export function valueToSQLString(value: string | number | Date | boolean): string {
  if (typeof (value) === 'number') return String(value);
  if (typeof (value) === 'string') return `'${value}'`;
  if (typeof (value) === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `FROM_UNIXTIME(${value.getTime()} * 0.001)`;
  return 'NULL';
}
