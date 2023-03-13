import {PlanetActivity, StampedEspionageReport} from 'ogame-api-facade';
import {StringNumberMap} from 'ogame-common/common';
import {
  AllianceClass,
  Buildings,
  BuildingTypeId,
  Coordinates,
  CoordinateType,
  DefenseTypeId,
  PlayerClass,
  Researches,
  ResearchTypeId,
  Resources,
  ShipTypeId
} from 'ogame-core/types/core';
import {EspionageReportParser} from '../../../uniplatform/core/types/parsers';
import {parseLocalDate, parseOnlyNumbers} from '../parsers-common';
import {readAttribute, readBetween} from './no-dom-common';

export class NoDOMEspionageReportParser implements EspionageReportParser {
  parseReport(body: string): StampedEspionageReport | undefined {
    return parseReport(body);
  }
  parseReportList(body: string): EspionageReportList {
    return parseReportListFull(body);
  }
}

export interface EspionageBriefHeader {
  id: number;
  timestamp: Date;
  coordinates: Coordinates;
  planetName: string;
}

export interface EspionageBriefContent {
  playerName: string;
  playerStatus: string;
  playerClass?: string;
  playerAllianceClass?: string;
  activity: PlanetActivity;
  counterEspionage: number;
  loot: number;
  infoLevel: number;
}

export interface EspionageBrief {
  header: EspionageBriefHeader;
  isCounterEspionage: boolean;
  content?: EspionageBriefContent;
  // TODO add content section for counter-espionage report
}

export interface EspionageReportList {
  token: string;
  page: number;
  totalPages: number;
  reports: EspionageBrief[];
}

export function parseReportListFull(body: string): EspionageReportList {
  let topPaginationStart = body.indexOf(`<ul`);
  let topPaginationEnd = body.indexOf(`</ul>`);
  const paginationBlock = body.substring(topPaginationStart, topPaginationEnd + `</ul>`.length).trim();

  const [page, totalPages] = parsePagination(paginationBlock);
  const token = parseReportListForToken(body, topPaginationEnd);
  let bottomPaginationStart = body.indexOf(`<ul`, topPaginationEnd);
  let briefs = getSections(body, `<li`, topPaginationEnd, bottomPaginationStart);
  let empty = !briefs.length || readAttribute(briefs[0], 0, 'class') === 'no_msg';
  return {
    token, page, totalPages,
    reports: empty ? [] : briefs.map(body => parseBrief(body))
  };
}
function parsePagination(block: string): [number, number] {
  const rawValues = readBetween(block, block.indexOf('curPage'), '>', '<');
  const slashIndex = rawValues.indexOf('/');
  return [
    +rawValues.substring(0, slashIndex).trim(),
    +rawValues.substring(slashIndex + 1).trim()
  ]
}
function parseApiKey(block: string, index: number): string {
  const nearby = block.indexOf('icon_apikey', index);
  const title = readAttribute(block, nearby, 'title');
  const valuePosition = title.indexOf('value');
  return readBetween(title, valuePosition, '\'', '\'');
}

function parseBrief(body: string): EspionageBrief {
  const headStart = body.indexOf(`<div class="msg_head">`);
  const contentStart = body.indexOf(`<span class="msg_content">`, headStart);
  const contentEnd = body.indexOf(`<div class="msg_actions clearfix">`, contentStart);
  const head = body.substring(headStart, contentStart).trim();
  const content = body.substring(contentStart, contentEnd).trim();

  const id = +readAttribute(body, 0, 'data-msg-id');
  const [planetName, coordinates, timestamp] = parseMessageHead(head);
  const isCounterEspionage = content.indexOf(`<span class="espionageDefText">`) !== -1;
  if (isCounterEspionage) return {
    header: {id, timestamp, coordinates, planetName},
    isCounterEspionage
  };
  const blocks = getSections(content, `<div class="compacting">`);
  const [playerName, playerStatus, activity] = parseBriefPlayerAndActivity(blocks[0]);
  // TODO player and alliance class
  const [loot, counterEspionage] = parseBriefLootAndCounterEspionage(blocks[4]);
  const extras = getSections(blocks[5], `<span`);
  return {
    header: {id, timestamp, coordinates, planetName},
    isCounterEspionage,
    content: {playerName, playerStatus, activity, counterEspionage, loot, infoLevel: extras.length}
  };
}

function parseBriefLootAndCounterEspionage(block: string): [number, number] {
  const espionageStart = block.lastIndexOf(`<span`, block.indexOf('fright'));
  const lootBlock = block.substring(block.indexOf(`<span`), espionageStart).trim();
  return [
    parseOnlyNumbers(textContent(lootBlock)),
    parseOnlyNumbers(textContent(block.substring(espionageStart)))
  ];
}

function parseBriefPlayerAndActivity(block: string): [string, string, PlanetActivity] {
  const activityStart = block.lastIndexOf(`<span`, block.indexOf('fright'));
  const [playerName, playerStatus] = parseBriefPlayer(block.substring(0, activityStart).trim());
  const activity = parseBriefActivity(block.substring(activityStart));
  return [playerName, playerStatus, activity];
}

function parseBriefPlayer(block: string): [string, string] {
  const colon = block.indexOf(':');
  const nameAndStatus = textContent(block.substring(colon + 1)).trim();
  const statusStart = nameAndStatus.indexOf('(');
  let status = '', name = nameAndStatus;
  if (statusStart !== -1) {
    status = nameAndStatus.substring(statusStart + 1, nameAndStatus.indexOf(')')).trim();
    name = nameAndStatus.substring(0, statusStart).trim();
  }
  return [name, status];
}

function parseBriefActivity(block: string): PlanetActivity {
  const activityHighlight = block.indexOf(`<font`);
  const activity: PlanetActivity = {
    active: activityHighlight !== -1
  };
  if (activity.active) {
    const time = parseOnlyNumbers(readBetween(block, activityHighlight, '>', '<'));
    // 15 and <15 are different
    if (time !== 15 || block.indexOf(`&lt;`, activityHighlight) === -1) activity.time = time;
  }
  return activity;
}

function parseMessageHead(head: string): [string, Coordinates, Date] {
  const [planetName, coordinates] = parseCoordinates(head, head.indexOf(`<figure`));
  let timestamp = parseLocalDate(readBetween(head, head.indexOf('msg_date'), '>', '<').trim());
  return [planetName, coordinates, timestamp];
}

const TOKEN_ATTRIBUTE_MARKER = `value=`;
export function parseReportListForToken(body: string, position: number = 0): string {
  const inputPosition = body.indexOf(`<input type=`, position);
  if (inputPosition === -1) return '';
  let tokenAttributePosition = body.indexOf(TOKEN_ATTRIBUTE_MARKER, inputPosition);
  if (tokenAttributePosition === -1) return '';
  tokenAttributePosition += TOKEN_ATTRIBUTE_MARKER.length;
  const quote = body[tokenAttributePosition];
  return readBetween(body, tokenAttributePosition, quote, quote);
}

const SECTION_MARKER = `<div class="section_title">`;
export function parseReport(body: string): StampedEspionageReport | undefined {
  if (body.indexOf('.espionageDefText') !== -1) return; // hostile espionage
  const messageStart = body.indexOf(`detail_msg`);
  let id = +readAttribute(body, messageStart, 'data-msg-id');
  // TODO use parseMessageHead() here
  let timestamp = parseLocalDate(readBetween(body, body.indexOf('msg_date', messageStart), '>', '<').trim());
  let titlePosition = body.indexOf('msg_title', messageStart);
  let [planetName, coordinates] = parseCoordinates(body, titlePosition);

  let contentStart = body.indexOf('detail_msg_ctn', messageStart);
  let sectionsStart = body.indexOf(SECTION_MARKER, contentStart);

  let [playerBlock, classBlock, allianceClassBlock, activityBlock] =
      getSections(body, `<div class="detail_txt">`, contentStart, sectionsStart);
  // TODO include class info in report
  let [playerName, playerStatus] = parseReportPlayer(playerBlock);
  let [activity, counterEspionage] = parseReportActivity(activityBlock);
  let playerClass = parsePlayerClass(classBlock);
  let allianceClass = parseAllianceClass(allianceClassBlock);
  let sections = getSections(body, SECTION_MARKER, sectionsStart);
  let sectionsByType = ['resources', 'ships', 'defense', 'buildings', 'research']
      .map(dataType => sections.filter(section => sectionMatches(section, dataType)));

  let resources = parseResources(sectionsByType[0][0]);
  let fleetInfo = parseInfoSection(sectionsByType[1][sectionsByType[1].length - 1], 'tech', ShipTypeId);
  let defenseInfo = parseInfoSection(sectionsByType[2][0], 'defense', DefenseTypeId);
  let buildingInfo = parseInfoSection(sectionsByType[3][0], 'building', BuildingTypeId);
  let researchInfo = parseInfoSection(sectionsByType[4][0], 'research', ResearchTypeId);

  let infoLevel = +!!fleetInfo + +!!defenseInfo + +!!buildingInfo + +!!researchInfo;
  const apiKey = parseApiKey(body, body.indexOf('msg_actions'));

  return {
    id, timestamp, infoLevel, coordinates, apiKey,
    planetName, playerName, playerStatus,
    activity, counterEspionage,
    playerClass, allianceClass,
    resources,
    fleet: fleetInfo,
    defense: defenseInfo,
    buildings: buildingInfo as Buildings,
    researches: researchInfo as Researches
  };
}

function parsePlayerClass(block: string): PlayerClass {
  let rawClass = readBetween(block, block.indexOf(':'), '>', '<').trim().toLowerCase();
  rawClass = rawClass.replaceAll(NBSP, '').trim();

  switch (rawClass) {
    case 'collector':
    case 'discoverer':
    case 'general':
      return rawClass;
    default:
      return 'none';
  }
}

function parseAllianceClass(block: string): AllianceClass {
  let classList = readAttribute(block, block.indexOf(':'), 'class').trim().toLowerCase();
  if (classList.indexOf('trader') !== -1) return 'trader';
  if (classList.indexOf('warrior') !== -1) return 'warrior';
  if (classList.indexOf('researcher') !== -1) return 'researcher';
  return 'none';
}

function sectionMatches(section: string, dataType: string) {
  return readAttribute(section, 0, 'data-type') === dataType;
}
function parseInfoSection(body: string, prefix: string, mapping: { [techId: number]: string }): StringNumberMap | undefined {
  if (body.indexOf(`detail_list_fail`) !== -1) return;
  let result: StringNumberMap = {};
  let items = getSections(body, `<li`, 0);
  items.forEach(record => {
    let prefixed = readAttribute(record, record.indexOf(`img`), 'class').trim();
    if (!prefixed.startsWith(prefix)) throw new Error(`incorrect section identifier for prefix ${prefix}: ${prefixed}`);
    const key = mapping[+prefixed.substring(prefix.length)];
    result[key] = parseOnlyNumbers(readBetween(record, record.indexOf('fright'), '>', '<'));
  });
  return result;
}

function parseReportPlayer(block: string): [string, string] {
  let name = readBetween(block, afterNBSP(block), '', `<`);
  let statusRaw = readBetween(block, 0, `(`, `)`);
  let status = textContent(statusRaw);
  return [name, status];
}

function parseReportActivity(block: string): [PlanetActivity, number] {
  let innerDivPosition = block.indexOf(`<div`, SECTION_MARKER.length);
  let counterEspionage = parseOnlyNumbers(block.substring(0, innerDivPosition));
  let fontPosition = block.indexOf(`<font`, innerDivPosition);
  let activity: PlanetActivity = {
    active: fontPosition !== -1
  };
  if (activity.active) // < 15 min is ignored in espionage report and always displayed as just "15"
    activity.time = +readBetween(block, fontPosition, '>', '<').trim();
  return [activity, counterEspionage];
}

function parseCoordinates(body: string, titlePosition: number): [string, Coordinates] {
  const msgTitle = readBetween(body, titlePosition, `</figure>`, `<`).trim();
  const [planetName, galaxy, system, position] = /^(.+)\s?\[(\d):(\d{1,3}):(\d{1,2})]$/.exec(msgTitle)!.slice(1);
  const coordinates: Coordinates = {
    galaxy: +galaxy,
    system: +system,
    position: +position
  };
  const iconClass = readAttribute(body, body.indexOf(`<figure`, titlePosition), 'class');
  coordinates.type = iconClass.indexOf('moon') !== -1 ? CoordinateType.Moon : CoordinateType.Planet;
  return [planetName.trim(), coordinates];
}

function parseResources(block: string): Resources {
  let sections = getSections(block, `<li`, block.indexOf(`<ul`), block.indexOf(`</ul>`));
  let [metal, crystal, deuterium, energy] = sections.map(section => parseOnlyNumbers(readAttribute(section, 0, 'title')));
  return {
    metal,
    crystal,
    deuterium,
    energy
  };
}

function getSections(body: string, marker: string, start: number = 0, end: number = body.length): string[] {
  let result: string[] = [];
  let sectionStart = start, previousSection = -1;
  while ((sectionStart = body.indexOf(marker, sectionStart)) !== -1 && sectionStart < end) {
    if (previousSection !== -1)
      result.push(body.substring(previousSection, sectionStart).trim());
    previousSection = sectionStart;
    sectionStart += marker.length;
  }
  if (previousSection !== -1)
    result.push(body.substring(previousSection, end).trim());
  return result;
}

const NBSP = `&nbsp;`;
function afterNBSP(block: string): number {
  let result = -1;
  let nbspPosition = 0;
  while ((nbspPosition = block.indexOf(NBSP, nbspPosition)) !== -1)
    result = (nbspPosition += NBSP.length);
  return result;
}

function textContent(block: string): string {
  let fragments: string[] = [];
  let position = 0, inTag: boolean = false;
  while (position !== -1 && position < block.length) {
    let nextPosition = block.indexOf(inTag ? `>` : `<`, position);
    if (nextPosition === -1) {
      if (!inTag) fragments.push(block.substring(position));
      break;
    }
    if (!inTag)
      fragments.push(block.substring(position, nextPosition));
    position = nextPosition + 1;
    inTag = !inTag;
  }
  return fragments.join('');
}
