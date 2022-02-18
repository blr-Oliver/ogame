import {EventListParser} from '../../../common/parsers';
import {FlightEvent, StringNumberMap} from '../../../common/report-types';
import {translateEntries} from '../../../common/translate';
import {CoordinateType, FleetPartial, MissionType, Resources} from '../../../common/types';
import {parseCoordinates, parseOnlyNumbers, readAttribute, readBetween} from '../parsers-common';

export class NoDOMEventListParser implements EventListParser {
  parseEventList(body: string): FlightEvent[] {
    return parseEventList(body);
  }
}

export function parseEventList(body: string): FlightEvent[] {
  let position = body.indexOf(`<table id="eventContent">`);
  if (position === -1) return [];
  let result: FlightEvent[] = [];
  let rowStart = position;
  while ((rowStart = body.indexOf(`<tr`, rowStart)) !== -1) {
    let className = readAttribute(body, rowStart, 'class');
    if (className.indexOf('eventFleet') !== -1) {
      result.push(parseEvent(body, rowStart));
    } else if (className.indexOf('allianceAttack') !== -1) {
      // TODO
    }
    rowStart += `<tr`.length;
  }
  return result;
}

function parseEvent(body: string, rowStart: number): FlightEvent {
  let idValue = readAttribute(body, rowStart, 'id');
  let id = +idValue.substring('eventRow-'.length);
  let mission: MissionType = +readAttribute(body, rowStart, 'data-mission-type')!;
  let isReturnFlight = readAttribute(body, rowStart, 'data-return-flight') === 'true';
  let arrivalTime = new Date(+readAttribute(body, rowStart, 'data-arrival-time') * 1000);

  const cells = getCells(body, rowStart);
  let isFriendly = readAttribute(cells[0], cells[0].indexOf(`<span`), 'class').indexOf('friendly') !== -1;
  let fromName = readBetween(cells[3], 0, `</figure>`, `</td>`).trim();
  let fromType = getType(readAttribute(cells[3], cells[3].indexOf(`<figure`), 'class'));
  let from = parseCoordinates(readBetween(cells[4], cells[4].indexOf(`<a`), `>`, `<`).trim())!;

  let toName = readBetween(cells[7], 0, `</figure>`, `</td>`).trim();
  let toType = getType(readAttribute(cells[7], cells[7].indexOf(`<figure`), 'class'));
  let to = parseCoordinates(readBetween(cells[8], cells[8].indexOf(`<a`), `>`, `<`).trim())!;

  let tooltipHolder = readAttribute(cells[6], 0, 'title');
  let fleet: FleetPartial, cargo: Resources | undefined;
  [fleet, cargo] = parseFleetInfo(tooltipHolder);
  if (!cargo.metal && !cargo.crystal && !cargo.deuterium) cargo = void 0;

  let result: FlightEvent = {
    id,
    mission,
    time: arrivalTime,
    isReturn: isReturnFlight,
    isFriendly,
    to: {
      ...to,
      type: toType
    },
    toName,
    fleet: [{
      from: {
        ...from,
        type: fromType
      },
      fromName,
      fleet,
      cargo
    }]
  };

  let sendMailLink = readBetween(cells[10], 0, `>`, `<span`).trim();
  if (sendMailLink) {
    result.targetPlayerId = +readAttribute(sendMailLink, 0, 'data-playerId');
    result.targetPlayerName = readAttribute(sendMailLink, 0, 'title');
  }
  return result;
}

function getCells(body: string, position: number, end?: number): string[] {
  if (!end || end === -1) {
    end = body.indexOf(`</tr>`, position);
    if (end === -1) end = body.length;
  }
  let cells: string[] = [];
  let cellStart = position;
  while ((cellStart = body.indexOf(`<td`, cellStart)) !== -1 && cellStart < end) {
    const cellEndMarker = `</td>`;
    let cellEnd = body.indexOf(cellEndMarker, cellStart) + cellEndMarker.length;
    cells.push(body.substring(cellStart, cellEnd));
    cellStart = cellEnd;
  }
  return cells;
}

function parseAlliedHeader(tr: HTMLTableRowElement): FlightEvent | undefined {
  return; // TODO
}

function addPartners(main: FlightEvent, partners: HTMLTableRowElement[]): FlightEvent {
  return main;
}

function getType(classList: string): CoordinateType | undefined {
  if (classList.indexOf('planet') !== -1) return CoordinateType.Planet;
  if (classList.indexOf('moon') !== -1) return CoordinateType.Moon;
  if (classList.indexOf('tf') !== -1) return CoordinateType.Debris;
}

function readMapFromTable(cells: string[]): StringNumberMap {
  let data: StringNumberMap = {};
  for (let i = 1; i < cells.length; i += 2) {
    let key = readBetween(cells[i - 1], 0, `>`, `<`).trim();
    key = key.substring(0, key.length - 1);
    data[key] = parseOnlyNumbers(readBetween(cells[i], 0, `>`, `<`).trim());
  }
  return data;
}

function parseFleetInfo(tooltip: string): [FleetPartial, Resources] {
  tooltip = tooltip
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"');
  let firstTh = tooltip.indexOf(`<th`);
  if (firstTh === -1) return [{}, {}];
  let secondTh = tooltip.indexOf(`<th`, firstTh + `<th`.length);
  let shipCells = getCells(tooltip, firstTh, secondTh);
  let shipData = readMapFromTable(shipCells);
  let cargoData: StringNumberMap;
  if (secondTh !== -1) {
    let cargoCells = getCells(tooltip, secondTh, tooltip.length);
    cargoData = readMapFromTable(cargoCells);
  } else
    cargoData = {};
  return [
    translateEntries('ships', shipData, false, false)!,
    translateEntries('resources', cargoData, false, false)!
  ];
}