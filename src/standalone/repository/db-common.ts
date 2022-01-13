export function valueToSQLString(value: string | number | Date | boolean | undefined | null): string {
  if (typeof (value) === 'number') return String(value);
  if (typeof (value) === 'string') return `'${value}'`;
  if (typeof (value) === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `FROM_UNIXTIME(${value.getTime()} * 0.001)`;
  return 'NULL';
}
