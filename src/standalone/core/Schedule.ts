import {Mission, MissionType, Speed} from '../../common/types';
import {Mapper} from './Mapper';

type ScheduledMission = Mission & { timestamp: Date };
let missions: ScheduledMission[] = [
  {
    from: 33638393,
    to: {galaxy: 1, system: 308, position: 8},
    fleet: {largeCargo: 30, recycler: 1},
    mission: MissionType.Attack,
    speed: 7,
    cargo: {metal: 370000, crystal: 373000, deut: 115000},
    timestamp: new Date(2019, 4, 19, 15, 22, 0)
  },
  {
    from: 33638474,
    to: {galaxy: 1, system: 267, position: 4},
    fleet: {
      smallCargo: 442,
      largeCargo: 193 + 153,
      lightFighter: 243,
      heavyFighter: 84,
      cruiser: 41,
      battleship: 12,
      battlecruiser: 1,
      bomber: 61,
      recycler: 75
    },
    mission: MissionType.Attack,
    speed: 7,
    cargo: {metal: 1500000, crystal: 1500000, deut: 9000000},
    timestamp: new Date(2019, 4, 19, 15, 26, 0)
  }
];
export function launchDelayed() {
  let now = Date.now();
  for (let mission of missions) {
    let delay = mission.timestamp.getTime() - now;
    if (delay > 0)
      setTimeout(() => Mapper.instance.launch(mission), delay)
    else
      Mapper.instance.launch(mission);
  }
}
