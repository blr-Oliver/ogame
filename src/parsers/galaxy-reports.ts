import {parseOnlyNumbers} from './common';

export interface GalaxySystemInfo {
  galaxy: number;
  system: number;
  timestamp?: Date;
  slots: GalaxySlotInfo[];
}

export interface GalaxySlotInfo {
  planet?: PlanetGalaxyInfo;
  moon?: MoonGalaxyInfo;
  debris?: DebrisGalaxyInfo;
  player?: PlayerGalaxyInfo;
  alliance?: AllianceGalaxyInfo;
}

export interface PlanetGalaxyInfo {
  id: number | string;
  name: string;
  active?: boolean;
  activityTime?: number;
}

export interface MoonGalaxyInfo extends PlanetGalaxyInfo {
  size: number;
}

export interface DebrisGalaxyInfo {
  metal: number;
  crystal: number;
}

export interface PlayerGalaxyInfo {
  id: number | string;
  name: string;
  status: string;
  rank?: number; // some players (admins) do not have rank
}

export interface AllianceGalaxyInfo {
  id: number | string;
  name: string;
  shortName: string;
  rank: number;
  members: number;
}

export function parseGalaxy(doc: DocumentFragment): GalaxySystemInfo {
  const table: HTMLTableElement = doc.querySelector('#galaxytable');
  const galaxy = +table.getAttribute('data-galaxy');
  const system = +table.getAttribute('data-system');
  const rows = table.tBodies[0].rows;
  let result: GalaxySystemInfo = {
    galaxy, system, slots: Array(15)
  };
  for (let i = 0; i < 15; ++i)
    result.slots[i] = parseRow(rows[i]);
  return result;
}

function parseRow(tr: HTMLTableRowElement): GalaxySlotInfo {
  let result: GalaxySlotInfo = {};

  let planet = parsePlanet(tr.cells[1]);
  let moon = parseMoon(tr.cells[3]);
  let debris = parseDebris(tr.cells[4]);
  let player = parsePlayer(tr.cells[5]);
  let alliance = parseAlliance(tr.cells[6]);

  if (planet) result.planet = planet;
  if (moon) result.moon = moon;
  if (debris) result.debris = debris;
  if (player) result.player = player;
  if (alliance) result.alliance = alliance;

  // due to a bug there could be a moon in empty space, without a planet
  if (!planet && !moon && !debris) return null;
  return result;
}

function parsePlanet(td: HTMLTableCellElement): PlanetGalaxyInfo {
  const id = td.getAttribute('data-planet-id');
  if (id) {
    const name = td.querySelector('h1 .textNormal').textContent.trim();
    const activityContainer = td.querySelector('.ListImage .activity');
    const active = activityContainer != null;
    let result: PlanetGalaxyInfo = {
      id, name, active
    };
    if (active) {
      if (activityContainer.matches('.showMinutes'))
        result.activityTime = +activityContainer.textContent;
    }
    return result;
  }
}

function parseMoon(td: HTMLTableCellElement): MoonGalaxyInfo {
  const id = td.getAttribute('data-moon-id');
  if (id) {
    const name = td.querySelector('h1 .textNormal').textContent.trim();
    const size = parseInt(td.querySelector('.ListImage #moonsize').textContent); // strips units
    const activityContainer = td.querySelector('.ListImage .activity');
    const active = activityContainer != null;
    let result: MoonGalaxyInfo = {
      id, name, active, size
    };
    if (active) {
      if (activityContainer.matches('.showMinutes'))
        result.activityTime = +activityContainer.textContent;
    }
    return result;
  }
}

function parseDebris(td: HTMLTableCellElement): DebrisGalaxyInfo {
  let content = td.querySelectorAll('.debris-content');
  if (content && content.length) {
    return {
      metal: parseOnlyNumbers(content[0].textContent),
      crystal: parseOnlyNumbers(content[1].textContent)
    };
  }
}

function parsePlayer(td: HTMLTableCellElement): PlayerGalaxyInfo {
  let tooltipDiv = td.querySelector('div[id]');
  if (tooltipDiv) {
    const id = tooltipDiv.id.substring('player'.length);
    const name = tooltipDiv.querySelector('h1>span').textContent.trim();
    const status = td.querySelector('.status').textContent.trim();
    let result: PlayerGalaxyInfo = {id, name, status};
    let rankContainer = tooltipDiv.querySelector('.rank>a');
    if (rankContainer)
      result.rank = +rankContainer.textContent;
    return result;
  }
}

function parseAlliance(td: HTMLTableCellElement): AllianceGalaxyInfo {
  let tooltipDiv = td.querySelector('div[id]');
  if (tooltipDiv) {
    tooltipDiv.remove(); // there is a bug in original OGame renderer - <div> tag here is misplaced
    const id = tooltipDiv.id.substring('alliance'.length);
    const name = tooltipDiv.querySelector('h1').textContent.trim();
    const rank = +tooltipDiv.querySelector('.rank>a').textContent;
    const members = parseOnlyNumbers(tooltipDiv.querySelector('.members').textContent);
    const shortName = td.textContent.trim();
    return {
      id, name, shortName, rank, members
    };
  }
}
