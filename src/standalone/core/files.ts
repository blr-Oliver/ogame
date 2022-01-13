import * as fs from 'fs';

export function dumpFile(filename: string, data: string | Object) {
  if (typeof (data) === 'string')
    fs.writeFileSync(filename, data, 'utf-8');
  else
    fs.writeFileSync(filename, JSON.stringify(data), 'utf-8');
}
