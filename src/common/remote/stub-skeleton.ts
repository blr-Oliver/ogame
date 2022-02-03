import {ReplyingMessagePort} from '../message/ReplyingMessagePort';

export type MessageType = 'invoke' | 'get' | 'set' | 'assign';

export interface RemoteMessage {
  type: MessageType;
  member: string[];
  args?: any[];
}

export function remoteInvoke<T>(port: ReplyingMessagePort, member: string[], ...args: any[]): Promise<T> {
  return port.postMessage({
    type: 'invoke',
    member, args
  }).then(event => event.data);
}

export function remoteGet<T>(port: ReplyingMessagePort, member: string[]): Promise<T> {
  return port.postMessage({
    type: 'get',
    member
  }).then(event => event.data);
}

export function remoteSet<T>(port: ReplyingMessagePort, member: string[], value: T): Promise<void> {
  return port.postMessage({
    type: 'set',
    member,
    args: [value]
  }).then();
}

export function remoteAssign<T>(port: ReplyingMessagePort, member: string[], value: T | Partial<T>): Promise<T> {
  return port.postMessage({
    type: 'assign',
    member,
    args: [value]
  }).then(event => event.data);
}
