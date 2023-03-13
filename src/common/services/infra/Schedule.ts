import {Launcher} from 'ogame-api-facade';
import {Mission} from 'ogame-core';

export class MissionScheduler {
  private tasks: ReturnType<typeof setTimeout>[] = [];

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
