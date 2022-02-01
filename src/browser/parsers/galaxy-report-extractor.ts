import {GalaxyParser} from '../../common/parsers';
import {
  AllianceGalaxyInfo,
  DebrisGalaxyInfo,
  GalaxySlot,
  GalaxySlotInfo,
  GalaxySystemInfo,
  MoonGalaxyInfo,
  PlanetGalaxyInfo,
  PlayerGalaxyInfo,
  PlayerStatusInfo
} from '../../common/report-types';
import {CoordinateType} from '../../common/types';

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
    metal: rawPlanet.resources?.metal.amount,
    crystal: rawPlanet.resources?.crystal.amount
  }
}
export function extractGalaxy(rawData: any, timestamp: Date = new Date()): GalaxySystemInfo {
  const galaxy = rawData.system.galaxy;
  const system = rawData.system.system;
  const slots: GalaxySlot[] = Array(16);
  const rawSlots: any[] = rawData.system.galaxyContent;
  let empty = true;
  for (let i = 0; i < rawSlots.length; ++i) {
    const rawSlot = rawSlots[i];
    const planets: any[] = rawSlot.planets;
    if (planets.length) {
      empty = false;
      const position = rawSlot.position;
      const slotInfo: GalaxySlotInfo = {};
      if (rawSlot.player.playerId !== 99999) {
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
      slots[i] = {
        ...slotInfo,
        galaxy, system, position, timestamp
      };
    }
  }
  return {galaxy, system, timestamp, empty, slots};
}
