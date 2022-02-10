import {ReplyingMessageChannel} from '../message/ReplyingMessageChannel';
import {ReplyingMessageEvent} from '../message/ReplyingMessageEvent';
import {AutoObserve, AutoObserveSettings, AutoObserveState} from '../services/AutoObserve';
import {RemoteMessage} from './stub-skeleton';

export class AutoObserveSkeleton {
  constructor(private readonly channel: ReplyingMessageChannel,
              private readonly delegate: AutoObserve) {
    channel.addEventListener('message', e => this.handleMessage(e));
  }

  private handleMessage(e: ReplyingMessageEvent) {
    const message: RemoteMessage = e.data;
    switch (message.type) {
      case 'get':
        e.reply(this.handleGet(message.member), true);
        break;
      case 'set':
        this.handleSet(message.member, message.args![0]);
        e.reply(void 0, true);
        break;
      case 'assign':
        e.reply(this.handleAssign(message.member, message.args![0]), true);
        break;
      case 'invoke':
        e.reply(this.handleInvoke(message.member, message.args || []), true);
        break;
    }
  }

  private handleGet(member: string[]): any {
    if (member.length === 0) return this.getState();
    if (member.length === 1 && member[0] === 'settings') return this.getSettings();
    return member.reduce((context: any, property) => context[property]!, this.delegate);
  }

  private handleSet(member: string[], value: any) {
    const path = member.slice(0, -1);
    const context = path.reduce((context: any, property) => context[property]!, this.delegate);
    const property = member[path.length];
    context[property] = value;
  }

  private handleAssign(member: string[], value: any): any {
    const context = member.reduce((context: any, property) => context[property]!, this.delegate);
    return Object.assign(context, value);
  }

  private handleInvoke(member: string[], args: any[]): any {
    const path = member.slice(0, -1);
    const context = path.reduce((context: any, property) => context[property]!, this.delegate);
    const method = member[path.length];
    return context[method](...args);
  }

  private getState(): AutoObserveState {
    return {
      status: this.delegate.status,
      scheduledContinue: this.delegate.scheduledContinue,
      queue: this.delegate.queue,
      inProgress: this.delegate.inProgress,
      settings: this.getSettings()
    };
  }
  private getSettings(): AutoObserveSettings {
    const s = this.delegate.settings;
    return {
      delay: s.delay,
      timeout: s.timeout,
      emptyTimeout: s.emptyTimeout
    }
  }
}
