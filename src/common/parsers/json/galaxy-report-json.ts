import {GalaxyParser} from '../../../uniplatform/core/types/parsers';
import {
  AllianceGalaxyInfo,
  DebrisGalaxyInfo,
  GalaxyClass,
  GalaxySlot,
  GalaxySlotInfo,
  GalaxySystemInfo,
  MoonGalaxyInfo,
  PlanetGalaxyInfo,
  PlayerGalaxyInfo,
  PlayerStatusInfo
} from '../../../uniplatform/core/types/reports';
import {CoordinateType} from '../../../uniplatform/core/types/core';

export class JSONGalaxyParser implements GalaxyParser {
  parseGalaxy(body: string, timestamp?: Date): GalaxySystemInfo {
    return extractGalaxy(JSON.parse(body), timestamp);
  }
}

function extractStatusInfo(rawPlayer: any): PlayerStatusInfo {
  return {
    inactive: (+rawPlayer.isInactive) + (+rawPlayer.isLongInactive),
    vacation: rawPlayer.isOnVacation ? 1 : 0,
    admin: rawPlayer.isAdmin ? 1 : 0,
    banned: rawPlayer.isBanned ? 1 : 0,
    newbie: rawPlayer.isNewbie ? 1 : 0,
    honorableTarget: rawPlayer.isHonorableTarget ? 1 : 0,
    strong: rawPlayer.isStrong ? 1 : 0,
    outlaw: rawPlayer.isOutlaw ? 1 : 0
  };
}
function extractAlliance(rawPlayer: any): AllianceGalaxyInfo | undefined {
  if (rawPlayer.allianceId)
    return {
      id: rawPlayer.allianceId,
      name: rawPlayer.allianceName,
      shortName: rawPlayer.allianceTag,
      rank: +rawPlayer.highscorePositionAlliance
    };
}
function extractPlayer(rawPlayer: any): PlayerGalaxyInfo {
  return {
    id: rawPlayer.playerId,
    name: rawPlayer.playerName,
    status: extractStatusInfo(rawPlayer),
    rank: rawPlayer.highscorePositionPlayer
  };
}
function extractPlanet(rawPlanet: any): PlanetGalaxyInfo {
  return {
    id: rawPlanet.planetId,
    name: rawPlanet.planetName,
    active: !!rawPlanet.activity.showActivity,
    activityTime: rawPlanet.activity.idleTime
  };
}
function extractMoon(rawPlanet: any): MoonGalaxyInfo {
  let moon: PlanetGalaxyInfo = extractPlanet(rawPlanet);
  return {
    ...moon,
    size: +rawPlanet.size
  };
}
function extractDebris(rawPlanet: any): DebrisGalaxyInfo {
  return {
    metal: +rawPlanet.resources?.metal?.amount || 0,
    crystal: +rawPlanet.resources?.crystal?.amount || 0
  }
}
export function determineSlotClass(slot: GalaxySlotInfo): GalaxyClass {
  const player = slot.player;
  if (player) {
    if (player.status.admin || !player.id || player.id === 99999) return GalaxyClass.NonPlayer;
    if (player.status.vacation) return GalaxyClass.Vacation;
    return GalaxyClass.Player;
  } else {
    if (slot.planet || slot.moon) return GalaxyClass.NonPlayer; // destroyed / abandoned planet
    if (slot.debris) return GalaxyClass.Debris;
    return GalaxyClass.Empty;
  }
}
export function extractGalaxy(rawData: any, timestamp: Date = new Date()): GalaxySystemInfo {
  const galaxy = rawData.system.galaxy;
  const system = rawData.system.system;
  const slots: GalaxySlot[] = Array(16);
  const rawSlots: any[] = rawData.system.galaxyContent;
  let empty = true;
  for (let i = 0; i < 16; ++i) {
    const rawSlot = rawSlots[i];
    let planets: any[] = rawSlot?.planets;
    if (planets && !(planets instanceof Array)) // 16th position
      planets = [planets];
    if (!planets?.length) {
      slots[i] = {galaxy, system, position: i + 1, timestamp, class: GalaxyClass.Empty};
    } else {
      empty = false;
      const position = rawSlot.position;
      const slotInfo: GalaxySlotInfo = {class: GalaxyClass.Unknown};
      if (rawSlot.player && rawSlot.player.playerId !== 99999) {
        let rawPlayer = rawSlot.player;
        let alliance = extractAlliance(rawPlayer);
        slotInfo.player = extractPlayer(rawPlayer);
        if (alliance) slotInfo.alliance = alliance;
      }
      for (let planet of planets) {
        switch (planet.planetType) {
          case CoordinateType.Planet:
            slotInfo.planet = extractPlanet(planet);
            break;
          case CoordinateType.Debris:
            slotInfo.debris = extractDebris(planet);
            break;
          case CoordinateType.Moon:
            slotInfo.moon = extractMoon(planet);
            break;
        }
      }
      slotInfo.class = determineSlotClass(slotInfo);
      slots[i] = {
        ...slotInfo,
        galaxy, system, position, timestamp
      };
    }
  }
  const systemClass = Math.max(...slots.map(slot => slot.class))
  return {galaxy, system, timestamp, empty, slots, class: systemClass};
}
