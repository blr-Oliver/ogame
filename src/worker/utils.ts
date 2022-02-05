import {systemCoordinatesKey} from '../common/common';
import {GalaxyRepository} from '../common/repository-types';
import {CoordinateType} from '../common/types';

export function rankSystemsWithInactiveTargets(galaxyRepo: GalaxyRepository) {
  galaxyRepo.findInactiveTargets()
      .then(targets => targets
          .filter(target => (target.type ?? CoordinateType.Planet) === CoordinateType.Planet)
          .map(target => ({target, key: systemCoordinatesKey([target.galaxy, target.system])}))
          .sort((a, b) => a.key.localeCompare(b.key) || a.target.position - b.target.position)
          .reduce((hash, wKey) => {
            if (!(wKey.key in hash)) hash[wKey.key] = [];
            hash[wKey.key].push(wKey.target.position);
            return hash;
          }, {} as { [key: string]: number[] }))
      .then(stats => console.log(stats));
}
