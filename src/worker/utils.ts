import {GalaxyRepository} from '../common/repository-types';
import {CoordinateType} from '../common/types';

export function rankSystemsWithInactiveTargets(galaxyRepo: GalaxyRepository): Promise<any> {
  return galaxyRepo.findInactiveTargets()
      .then(targets => targets
          .filter(target => (target.type ?? CoordinateType.Planet) === CoordinateType.Planet)
          .reduce((sysCounts, slot) => {
            if (!sysCounts[slot.galaxy]) sysCounts[slot.galaxy] = Array(499);
            if (!sysCounts[slot.galaxy][slot.system]) sysCounts[slot.galaxy][slot.system] = 0;
            ++sysCounts[slot.galaxy][slot.system];
            return sysCounts;
          }, [] as number[][])
          .map(galaxy => [0, 5, 20, 50].reduce(
              (res, wnd) => (res[wnd] = wrappingSum(galaxy, wnd), res),
              {} as { [wnd: string]: number[] })
          )
      );
}

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
