import {GalaxyParser} from '../../common/parsers';
import {
  AllianceGalaxyInfo,
  DebrisGalaxyInfo,
  GalaxySlotInfo,
  GalaxySystemInfo,
  MoonGalaxyInfo,
  PlanetGalaxyInfo,
  PlayerGalaxyInfo
} from '../../common/report-types';
import {HtmlParser} from './HtmlParser';
import {parseOnlyNumbers} from './parsers-common';

export class DOMGalaxyParser implements GalaxyParser {
  constructor(private readonly htmlParser: HtmlParser) {
  }

  parseGalaxy(body: string, timestamp?: Date): GalaxySystemInfo {
    return parseGalaxy(this.htmlParser.parse(body), timestamp);
  }
}

export function parseGalaxy(doc: ParentNode, timestamp: Date = new Date()): GalaxySystemInfo {
  const table: HTMLTableElement = doc.querySelector('#galaxytable')!;
  const galaxy = +table.getAttribute('data-galaxy')!;
  const system = +table.getAttribute('data-system')!;
  const rows = table.tBodies[0].rows;
  let result: GalaxySystemInfo = {
    galaxy, system, timestamp, slots: Array(16), empty: false
  };
  for (let i = 0; i < 15; ++i)
    result.slots[i] = {
      galaxy,
      system,
      position: i + 1,
      timestamp,
      ...parseRow(rows[i])
    };
  // TODO add deep space debris as 16th slot
  result.empty = result.slots.every(x => !x);
  return result;
}

function parseRow(tr: HTMLTableRowElement): GalaxySlotInfo | undefined {
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
  if (planet || moon || debris) return result;
}

function parsePlanet(td: HTMLTableCellElement): PlanetGalaxyInfo | undefined {
  const id = td.getAttribute('data-planet-id');
  if (id) {
    const name = td.querySelector('h1 .textNormal')!.textContent!.trim();
    const activityContainer = td.querySelector('.ListImage .activity');
    const active = activityContainer != null;
    let result: PlanetGalaxyInfo = {
      id, name, active
    };
    if (active) {
      if (activityContainer.matches('.showMinutes'))
        result.activityTime = +activityContainer.textContent!;
    }
    return result;
  }
}

function parseMoon(td: HTMLTableCellElement): MoonGalaxyInfo | undefined {
  const id = td.getAttribute('data-moon-id');
  if (id) {
    const name = td.querySelector('h1 .textNormal')!.textContent!.trim();
    const size = parseInt(td.querySelector('.ListImage #moonsize')!.textContent!); // strips units
    const activityContainer = td.querySelector('.ListImage .activity');
    const active = activityContainer != null;
    let result: MoonGalaxyInfo = {
      id, name, active, size
    };
    if (active) {
      if (activityContainer.matches('.showMinutes'))
        result.activityTime = +activityContainer.textContent!;
    }
    return result;
  }
}

function parseDebris(td: HTMLTableCellElement): DebrisGalaxyInfo | undefined {
  let content = td.querySelectorAll('.debris-content');
  if (content && content.length) {
    return {
      metal: parseOnlyNumbers(content[0].textContent!),
      crystal: parseOnlyNumbers(content[1].textContent!)
    };
  }
}

function parsePlayer(td: HTMLTableCellElement): PlayerGalaxyInfo | undefined {
  let tooltipDiv = td.querySelector('div[id]');
  if (tooltipDiv) {
    const id = tooltipDiv.id.substring('player'.length);
    const name = tooltipDiv.querySelector('h1>span')!.textContent!.trim();
    const rawStatus = td.querySelector('.status')!.textContent!.trim();
    // TODO parse rawStatus to flags
    let result: PlayerGalaxyInfo = {id, name, rawStatus};
    let rankContainer = tooltipDiv.querySelector('.rank>a');
    if (rankContainer)
      result.rank = +rankContainer.textContent!;
    return result;
  } else {
    // FIXME generalize this
    if (td!.textContent!.trim()) {
      return {
        id: 101497,
        name: 'Scrap Collector',
        rawStatus: '',
        rank: 38
      };
    }
  }
}

function parseAlliance(td: HTMLTableCellElement): AllianceGalaxyInfo | undefined {
  let tooltipDiv = td.querySelector('div[id]');
  if (tooltipDiv) {
    tooltipDiv.remove(); // there is a bug in original OGame renderer - <div> tag here is misplaced
    const id = tooltipDiv.id.substring('alliance'.length);
    const name = tooltipDiv.querySelector('h1')!.textContent!.trim();
    const rank = +tooltipDiv.querySelector('.rank>a')!.textContent!;
    const members = parseOnlyNumbers(tooltipDiv.querySelector('.members')!.textContent!);
    const shortName = td.textContent!.trim();
    return {
      id, name, shortName, rank, members
    };
  }
}
