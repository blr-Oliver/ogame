import {EspionageReportParser} from '../../../common/parsers';
import {PlanetActivity, PlayerStatusInfo, StampedEspionageReport, StringNumberMap} from '../../../common/report-types';
import {Buildings, BuildingTypeId, Coordinates, CoordinateType, DefenseTypeId, Researches, ResearchTypeId, Resources, ShipTypeId} from '../../../common/types';
import {parseLocalDate, parseOnlyNumbers, readAttribute, readBetween} from '../parsers-common';

export class NoDOMEspionageReportParser implements EspionageReportParser {
  parseReport(body: string): StampedEspionageReport | undefined {
    return parseReport(body);
  }
  parseReportList(body: string): number[] {
    return parseReportList(body);
  }
  parseReportListForToken(body: string): string {
    return parseReportListForToken(body);
  }
}

const TOKEN_ATTRIBUTE_MARKER = `value=`;
export function parseReportListForToken(body: string): string {
  const inputPosition = body.indexOf(`<input type=`);
  if (inputPosition === -1) return '';
  let tokenAttributePosition = body.indexOf(TOKEN_ATTRIBUTE_MARKER, inputPosition);
  if (tokenAttributePosition === -1) return '';
  tokenAttributePosition += TOKEN_ATTRIBUTE_MARKER.length;
  const quote = body[tokenAttributePosition];
  return readBetween(body, tokenAttributePosition, quote, quote);
}

const MESSAGE_START_MARKER = `<li class="msg`;
export function parseReportList(body: string): number[] {
  let result: number[] = [];
  let messageStart = 0;
  while ((messageStart = body.indexOf(MESSAGE_START_MARKER, messageStart)) !== -1) {
    result.push(+readAttribute(body, messageStart, `data-msg-id`));
    messageStart += MESSAGE_START_MARKER.length;
  }
  return result;
}

const SECTION_MARKER = `<div class="section_title">`;
export function parseReport(body: string): StampedEspionageReport | undefined {
  if (body.indexOf('.espionageDefText') !== -1) return; // hostile espionage
  const messageStart = body.indexOf(`detail_msg`);
  let id = +readAttribute(body, messageStart, 'data-msg-id');
  let timestamp = parseLocalDate(readBetween(body, body.indexOf('msg_date', messageStart), '>', '<').trim());
  let titlePosition = body.indexOf('msg_title', messageStart);
  let [planetName, coordinates] = parseCoordinates(body, titlePosition);
  coordinates.type = parseCoordinateType(body, titlePosition);

  let contentStart = body.indexOf('detail_msg_ctn', messageStart);
  let sectionsStart = body.indexOf(SECTION_MARKER, contentStart);

  let [playerBlock, classBlock, allianceClassBlock, activityBlock] =
      getSections(body, `<div class="detail_txt">`, contentStart, sectionsStart);
  // TODO include class info in report
  let [playerName, playerStatus] = parsePlayer(playerBlock);
  let [activity, counterEspionage] = parseActivity(activityBlock);
  let [resourceSection, fleetSection, defenseSection, buildingSection, researchSection] =
      getSections(body, SECTION_MARKER, sectionsStart);

  let resources = parseResources(resourceSection);
  let fleetInfo = parseInfoSection(fleetSection, 'tech', ShipTypeId);
  let defenseInfo = parseInfoSection(defenseSection, 'defense', DefenseTypeId);
  let buildingInfo = parseInfoSection(buildingSection, 'building', BuildingTypeId);
  let researchInfo = parseInfoSection(researchSection, 'research', ResearchTypeId);

  let infoLevel = +!!fleetInfo + +!!defenseInfo + +!!buildingInfo + +!!researchInfo;
  return {
    id,
    timestamp,
    infoLevel,
    coordinates,
    planetName,
    playerName,
    playerStatus,
    activity,
    counterEspionage,
    parsedStatus: {} as PlayerStatusInfo, // FIXME
    resources,
    fleet: fleetInfo,
    defense: defenseInfo,
    buildings: buildingInfo as Buildings,
    researches: researchInfo as Researches
  };
}

function parseInfoSection(body: string, prefix: string, mapping: { [techId: number]: string }): StringNumberMap | undefined {
  if (body.indexOf(`detail_list_fail`) !== -1) return;
  let result: StringNumberMap = {};
  let items = getSections(body, `<li`, 0);
  items.forEach(record => {
    let imgPosition = record.indexOf(`img`);
    let prefixed = readAttribute(record, record.indexOf(`img`), 'class').trim();
    if (!prefixed.startsWith(prefix)) throw new Error(`incorrect section identifier for prefix ${prefix}: ${prefixed}`);
    const key = mapping[+prefixed.substring(prefix.length)];
    result[key] = parseOnlyNumbers(readBetween(record, record.indexOf('fright'), '>', '<'));
  });
  return result;
}

function parsePlayer(block: string): [string, string] {
  let name = readBetween(block, afterNBSP(block), '', `<`);
  let statusRaw = readBetween(block, 0, `(`, `)`);
  let status = textContent(statusRaw);
  return [name, status];
}

function parseActivity(block: string): [PlanetActivity, number] {
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
  let [planetName, galaxy, system, position] = /^(.+)\s\[(\d):(\d{1,3}):(\d{1,2})]$/.exec(msgTitle)!.slice(1);
  let coordinates: Coordinates = {
    galaxy: +galaxy,
    system: +system,
    position: +position
  };
  return [planetName, coordinates];
}

function parseCoordinateType(body: string, titlePosition: number) {
  let iconClass = readAttribute(body, body.indexOf(`<figure`, titlePosition), 'class');
  return iconClass.indexOf('.moon') !== -1 ? CoordinateType.Moon : CoordinateType.Planet;
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

function getSections(body: string, marker: string, start: number, end: number = body.length): string[] {
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

