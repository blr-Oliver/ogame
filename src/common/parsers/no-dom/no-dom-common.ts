export function readAttribute(body: string, position: number, name?: string): string {
  if (name) {
    position = body.indexOf(name, position);
    if (position == -1) return '';
  }
  return readBetween(body, position, '"', '"');
}
export function readBetween(body: string, position: number, startMarker: string, endMarker: string): string {
  let start = body.indexOf(startMarker, position);
  if (start === -1) return '';
  start += startMarker.length;
  let end = body.indexOf(endMarker, start);
  if (end === -1) return '';
  return body.substring(start, end);
}