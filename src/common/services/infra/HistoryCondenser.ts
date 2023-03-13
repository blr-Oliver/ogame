import {GalaxyHistoryRepository} from 'ogame-repository-facade';
import {FloodGate} from '../../core/FloodGate';

export function condenseGalaxyHistory(repo: GalaxyHistoryRepository) {
  let slotHandler = new FloodGate((g, s, p) => repo.condenseHistory(g, s, p), 5);
  let systemHandler = new FloodGate((g, s) => {
    let tasks = [];
    if (s % 10 === 0) console.log(`condensing ... [${g}:${s}]`);
    for (let p = 1; p <= 16; ++p)
      tasks.push(slotHandler.offer(g, s, p));
    return Promise.all(tasks);
  }, 2, 100);
  let galaxyHandler = new FloodGate((g) => {
    let tasks = [];
    for (let s = 1; s <= 499; ++s) {
      tasks.push(systemHandler.offer(g, s));
    }
    return Promise.all(tasks);
  }, 1, 1000);
  for (let g = 1; g <= 9; ++g)
    galaxyHandler.offer(g);
}
