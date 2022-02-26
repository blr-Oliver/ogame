import {map} from '../../../common/common';
import {StampedEspionageReport, StringNumberMap} from '../../../common/report-types';
import {Buildings, BuildingTypeId, DefenseTypeId, Researches, ResearchTypeId, ShipTypeId} from '../../../common/types';
import {parseLocalDate, parseOnlyNumbers} from '../parsers-common';
import {HtmlParser} from './HtmlParser';

/**
 * @deprecated
 */
export class DOMEspionageReportParser {
  constructor(private readonly htmlParser: HtmlParser) {
  }

  parseReportList(body: string): number[] {
    return parseReportList(this.htmlParser.parse(body));
  }
  parseReportListForToken(body: string): string {
    return parseReportListForToken(this.htmlParser.parse(body));
  }
  parseReport(body: string): StampedEspionageReport | undefined {
    return parseReport(this.htmlParser.parse(body));
  }
}

export function parseReportListForToken(doc: ParentNode): string {
  return doc.querySelector('input[type="hidden"]')!.getAttribute('value')!;
}

export function parseReportList(doc: ParentNode): number[] {
  return map(doc.querySelectorAll('li[data-msg-id]')!, (el: Element) => +el.getAttribute('data-msg-id')!);
}

export function parseReport(doc: ParentNode): StampedEspionageReport | undefined {
  if (doc.querySelector('.espionageDefText')) return; // hostile espionage
  let id = +doc.querySelector('[data-msg-id]')!.getAttribute('data-msg-id')!;
  let timestamp = parseLocalDate(doc.querySelector('.msg_date')!.textContent!.trim());
  let msgTitle = doc.querySelector('.msg_title a.txt_link')!.textContent!.trim();
  let [planetName, galaxy, system, position] = /^(.+)\s\[(\d):(\d{1,3}):(\d{1,2})]$/.exec(msgTitle)!.slice(1);
  let type = doc.querySelector('.msg_title .planetIcon')!.matches('.moon') ? 3 : 1;

  let [nameBlock, classBlock, allianceClassBlock, activityBlock] = doc.querySelectorAll('.detail_msg_ctn .detail_txt');
  // TODO include class info in report
  let [playerName, playerStatus] = map(nameBlock.children[0].children, (el: Element) => el.textContent!.trim());

  let planetActivityBlock = activityBlock.querySelector('div');
  let timeBlock = activityBlock.querySelector('div > .red');
  let planetActivity = timeBlock != null, planetActivityTime;
  if (planetActivity && timeBlock)
    planetActivityTime = +timeBlock.textContent!;
  planetActivityBlock!.remove();

  let counterEspionage = parseOnlyNumbers(activityBlock.textContent!);
  let resourceBlock = doc.querySelector('.detail_msg_ctn ul[data-type="resources"]');

  let [metal, crystal, deuterium, energy] = map(resourceBlock!.querySelectorAll('.resource_list_el'),
      (el: Element) => parseOnlyNumbers(el.getAttribute('title')!));

  let fleetInfo = parseInfoSection(doc.querySelector(`.detail_list[data-type="ships"]`)!, 'tech', ShipTypeId);
  let defenseInfo = parseInfoSection(doc.querySelector(`.detail_list[data-type="defense"]`)!, 'defense', DefenseTypeId);
  let buildingInfo = parseInfoSection(doc.querySelector(`.detail_list[data-type="buildings"]`)!, 'building', BuildingTypeId);
  let researchInfo = parseInfoSection(doc.querySelector(`.detail_list[data-type="research"]`)!, 'research', ResearchTypeId);

  let infoLevel = +!!fleetInfo + +!!defenseInfo + +!!buildingInfo + +!!researchInfo;
  return {
    id,
    timestamp,
    infoLevel,
    coordinates: {
      galaxy: +galaxy,
      system: +system,
      position: +position,
      type
    },
    planetName,
    playerName,
    playerStatus,
    playerClass: 'none',
    allianceClass: 'none',
    activity: {
      active: planetActivity,
      time: planetActivityTime
    },
    counterEspionage,
    resources: {
      metal,
      crystal,
      deuterium,
      energy
    },
    fleet: fleetInfo,
    defense: defenseInfo,
    buildings: buildingInfo as Buildings,
    researches: researchInfo as Researches
  };
}

function parseInfoSection(container: Element, prefix: string, mapping: { [techId: number]: string }): StringNumberMap | undefined {
  if (!container.querySelector('.detail_list_fail')) {
    let result: StringNumberMap = {};
    container.querySelectorAll('.detail_list_el').forEach(record => {
      let prefixed = record.querySelector('div.float_left>img')!.classList[0].trim();
      if (!prefixed.startsWith(prefix)) throw new Error(`incorrect section identifier for prefix ${prefix}: ${prefixed}`);
      const key = mapping[+prefixed.substring(prefix.length)];
      result[key] = parseOnlyNumbers(record.querySelector('.fright')!.textContent!);
    });
    return result;
  }
}
