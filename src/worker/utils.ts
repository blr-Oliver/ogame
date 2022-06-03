export function wrappingSum(a: number[], wnd: number): number[] {
  const len = a.length;
  let result = Array(len);
  for (let i = 0; i < len; ++i) {
    let sum = a[i] || 0;
    for (let j = 0; j < wnd; ++j) {
      let left = (i - j + len) % len;
      let right = (i + j) % len;
      sum += (a[left] || 0) + (a[right] || 0);
    }
    result[i] = sum;
  }
  return result;
}
