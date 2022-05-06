import {Mission} from '../types';
import {Launcher} from './Mapper';

export class MissionScheduler {
  private tasks: number[] = [];

  constructor(private readonly launcher: Launcher) {
  }

  schedule(mission: Mission, date: Date) {
    console.debug(`Scheduler: scheduling mission at ${date}`);
    let timeToSleep = date.getTime() - Date.now();
    const taskId = setTimeout(() => {
      console.debug(`Scheduler: performing mission scheduled at ${date}`);
      this.launcher.launch(mission, 30);
    }, timeToSleep);
    this.tasks.push(taskId);
  }

  cancelAll() {
    while (this.tasks.length)
      clearTimeout(this.tasks.pop()!);
  }
}
