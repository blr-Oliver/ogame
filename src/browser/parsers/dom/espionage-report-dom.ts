import {map} from '../../../common/common';
import {EspionageReportParser} from '../../../common/parsers';
import {PlayerStatusInfo, StampedEspionageReport, StringNumberMap} from '../../../common/report-types';
import {translateEntries} from '../../../common/translate';
import {parseLocalDate, parseOnlyNumbers} from '../parsers-common';
import {HtmlParser} from './HtmlParser';

export class DOMEspionageReportParser implements EspionageReportParser {
  constructor(private readonly htmlParser: HtmlParser) {
  }

  parseReportList(body: string): number[] {
    return parseReportList(this.htmlParser.parse(body));
  }
  parseReport(body: string): StampedEspionageReport | undefined {
    return parseReport(this.htmlParser.parse(body));
  }
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

  let [nameBlock, activityBlock] = doc.querySelectorAll('.detail_msg_ctn .detail_txt');
  let [playerName, playerStatus] = map(nameBlock.children[0].children, (el: Element) => el.textContent!.trim());

  let planetActivityBlock = activityBlock.querySelector('div');
  let timeBlock = activityBlock.querySelector('div > .red');
  let planetActivity = timeBlock != null, planetActivityTime;
  if (planetActivity && timeBlock)
    planetActivityTime = +timeBlock.textContent!;
  planetActivityBlock!.remove();

  let counterEspionage = parseOnlyNumbers(activityBlock.textContent!);
  let resourceBlock = doc.querySelector('.detail_msg_ctn ul[data-type="resources"]');

  let [metal, crystal, deuterium, energy] = map(resourceBlock!.querySelectorAll('.res_value'),
      (el: Element) => parseOnlyNumbers(el.textContent!));

  let [fleetInfo, defenseInfo, buildingInfo, researchInfo] = ['ships', 'defense', 'buildings', 'research']
      .map(section => parseInfoSection(doc.querySelector(`.detail_list[data-type="${section}"]`)!));

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
    activity: {
      active: planetActivity,
      time: planetActivityTime
    },
    counterEspionage,
    parsedStatus: {} as PlayerStatusInfo, // FIXME
    resources: {
      metal,
      crystal,
      deuterium,
      energy
    },
    fleet: translateEntries('ships', fleetInfo),
    defense: translateEntries('defense', defenseInfo),
    buildings: translateEntries('buildings', buildingInfo),
    researches: translateEntries('research', researchInfo)
  };
}

function parseInfoSection(container: Element): StringNumberMap | undefined {
  if (!container.querySelector('.detail_list_fail')) {
    let result: StringNumberMap = {};
    container.querySelectorAll('.detail_list_el').forEach(record => {
      result[record.querySelector('.detail_list_txt')!.textContent!.trim()] = parseOnlyNumbers(record.querySelector('.fright')!.textContent!);
    });
    return result;
  }
}
