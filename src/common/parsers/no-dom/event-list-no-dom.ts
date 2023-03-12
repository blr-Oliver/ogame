import {CoordinateType, FleetPartial, MissionType, Resources} from 'ogame-core/types/core';
import {EventListParser} from '../../../uniplatform/core/types/parsers';
import {FlightEvent} from '../../../uniplatform/core/types/reports';
import {StringNumberMap} from '../../../uniplatform/util/common';
import {translateEntries} from '../../l12n/translate';
import {parseCoordinates, parseOnlyNumbers} from '../parsers-common';
import {readAttribute, readBetween} from './no-dom-common';

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

  const cells = getCells(body, rowStart, body.indexOf('</tr>', rowStart));
  let isFriendly = readAttribute(cells[0], cells[0].indexOf(`<span`), 'class').indexOf('friendly') !== -1;
  let fromName = readBetween(cells[3], 0, `</figure>`, `</`).trim();
  let fromType = getType(readAttribute(cells[3], cells[3].indexOf(`<figure`), 'class'));
  let from = parseCoordinates(readBetween(cells[4], cells[4].indexOf(`<a`), `>`, `<`).trim())!;

  let toName = readBetween(cells[7], 0, `</figure>`, `</`).trim(); // closing td or span
  let toType = getType(readAttribute(cells[7], cells[7].indexOf(`<figure`), 'class'));
  let to = parseCoordinates(readBetween(cells[8], cells[8].indexOf(`<a`), `>`, `<`).trim())!;

  let tooltipHolder = readAttribute(cells[6], 0, 'title');
  let fleet: FleetPartial, cargo: Resources | undefined;
  [fleet, cargo] = parseFleetTooltip(tooltipHolder);
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
    end = body.length;
  }
  let cells: string[] = [];
  let cellStart = position;
  const cellEndMarker = `</td>`;
  while ((cellStart = body.indexOf(`<td`, cellStart)) !== -1 && cellStart < end) {
    let cellEnd = body.indexOf(cellEndMarker, cellStart) + cellEndMarker.length;
    cells.push(body.substring(cellStart, cellEnd));
    cellStart = cellEnd;
  }
  return cells;
}

function getType(classList: string): CoordinateType | undefined {
  let classes = classList.split(' ');
  if (classes.indexOf('planet') !== -1) return CoordinateType.Planet;
  if (classes.indexOf('moon') !== -1) return CoordinateType.Moon;
  if (classes.indexOf('tf') !== -1) return CoordinateType.Debris;
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

export function parseFleetTooltip(tooltip: string, replaceHtmlEntities: boolean = true): [FleetPartial, Resources] {
  if (replaceHtmlEntities)
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
