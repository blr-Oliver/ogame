export type FieldMapping = { [dbField: string]: string[] };

export function extractObject(dbObject: any, mapping: FieldMapping): any {
  return extractFrom(dbObject, Object.keys(mapping), mapping);
}

export function extractFrom(dbObject: any, keys: string[], mapping: FieldMapping, target: any = {}, skipNulls: boolean = true): any {
  keys.forEach(key => {
    if (key in dbObject) {
      let value = dbObject[key];
      if (typeof (value) !== 'undefined' && (!skipNulls || value !== null))
        set(target, mapping[key], value);
    }
  });
  return target;
}

export function packObject(modelObject: any, mapping: FieldMapping): any {
  let result: any = {};
  for (let key in mapping) {
    let value = get(modelObject, mapping[key]);
    if (typeof value === 'undefined') value = null;
    result[key] = value;
  }
  return result;
}

export function set(obj: any, path: string[], value: any): void {
  const last = path.length - 1;
  for (let context = obj, i = 0; i <= last; ++i) {
    let property = path[i];
    if (i === last) context[property] = value;
    else
      context = context[property] || (context[property] = {});
  }
}

export function get(obj: any, path: string[]): any {
  let context = obj;
  for (let i = 0; i < path.length && context != null; ++i) {
    let property = path[i];
    if (property in context) context = context[property];
    else return;
  }
  return context;
}
