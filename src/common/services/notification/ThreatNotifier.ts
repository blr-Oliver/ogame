import {FlightEvent} from '../../report-types';
import {MissionType} from '../../types';

interface ThreatInfo {
  event: FlightEvent;
  notification?: Notification;
  notifiedTs?: number;
  nextPossibleNotifyTs?: number;
}

export interface NotificationOptions {
  body?: string;
  renotify?: boolean;
  tag?: string;
  timestamp?: number;
}

export interface Notification {
  readonly body: string;
  readonly tag: string;
  readonly title: string;
  close(): void;
}

export interface NotificationService {
  getNotifications(filter?: { tag: string }): Promise<Notification[]>;
  showNotification(title: string, options?: NotificationOptions): Promise<void>;
}

export class ThreatNotifier {
  private knownThreats: { [key: string]: ThreatInfo } = {};
  private ignoredThreats: { [key: string]: true } = {};
  checkMissionType = true;

  constructor(private readonly notifier: NotificationService) {
  }

  detectAndNotifyThreats(events: FlightEvent[]) {
    const threats = events
        .filter(e => !e.isFriendly && (!this.checkMissionType ||
            (e.mission === MissionType.Attack || e.mission === MissionType.Destroy || e.mission === MissionType.MissileAttack)))
        .reduce((hash, e) => (hash[e.id] = e, hash), {} as { [key: string]: FlightEvent });

    for (let id in this.knownThreats) {
      if (!(id in threats)) delete this.knownThreats[id];
    }
    for (let id in this.ignoredThreats) {
      if (!(id in threats)) delete this.ignoredThreats[id];
    }
    const now = Date.now();
    const threatsToNotify: ThreatInfo[] = [];
    for (let id in threats) {
      if (id in this.ignoredThreats) continue;
      if (id in this.knownThreats) {
        const matched = this.knownThreats[id];
        if (!matched.nextPossibleNotifyTs || matched.nextPossibleNotifyTs <= now) {
          threatsToNotify.push(matched);
          matched.nextPossibleNotifyTs = now + 1000 * 60 * 5;
        }
      } else {
        const newThreat: ThreatInfo = {
          event: threats[id]
        };
        this.knownThreats[id] = newThreat;
        threatsToNotify.push(newThreat);
      }
    }
    this.notifyThreats(threatsToNotify);
  }

  private notifyThreats(threats: ThreatInfo[]) {
    for (let threat of threats) {
      if (threat.notification) {
        threat.notification.close();
        threat.notification = undefined;
      }
      const to = threat.event.to;
      const tag = String(threat.event.id);
      const options: NotificationOptions = {
        body: `Incoming hostile mission to ${threat.event.toName}[${to.galaxy}:${to.system}:${to.position}] at ${threat.event.time}`,
        timestamp: threat.event.time.getTime(),
        tag: tag,
        renotify: true
      }
      threat.nextPossibleNotifyTs = undefined;
      this.notifier.showNotification('OGame', options)
          .then(() => this.notifier.getNotifications({tag}))
          .then(([notification]) => {
            threat.notification = notification;
            threat.notifiedTs = Date.now();
            threat.nextPossibleNotifyTs = threat.notifiedTs! + 1000 * 60 * 5;
          })
    }
  }
}
