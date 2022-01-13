import {Coordinates, CoordinateType, FleetPartial, MissionType, Resources} from '../../common/types';
import {parseCoordinates, parseOnlyNumbers} from './parsers-common';
import {StringNumberMap, translateEntries} from './espionage-reports';

export interface FlightEvent {
  id: number;
  mission: MissionType;
  time: Date;
  isReturn: boolean;
  isFriendly: boolean;
  to: Coordinates;
  toName?: string;
  targetPlayerName?: string;
  targetPlayerId?: number;
  fleet: EventFleet[];
}

export interface EventFleet {
  from: Coordinates;
  fromName?: string;
  fleet: FleetPartial;
  cargo?: Resources;
}

export function parseEventList(doc: DocumentFragment): FlightEvent[] {
  let eventTable: HTMLTableElement | null = doc.querySelector('#eventContent');
  if (!eventTable) return [];
  let result: FlightEvent[] = [];
  let rows = eventTable.rows;
  for (let i = 0; i < eventTable.rows.length; ++i) {
    if (rows[i].matches('.eventFleet'))
      result.push(parseEvent(rows[i]));
    else if (rows[i].matches('.allianceAttack')) {
      let alliedEvent = parseAlliedHeader(rows[i])!;  // TODO
      let partnerRows: HTMLTableRowElement[] = [];
      let selector = `partnerInfo union${alliedEvent.id}`;
      while (i + 1 < rows.length && rows[i + 1].matches(selector))
        partnerRows.push(rows[++i]);
      result.push(addPartners(alliedEvent, partnerRows));
    }
  }
  return result;
}

function parseEvent(tr: HTMLTableRowElement): FlightEvent {
  let id = +tr.id.substring('eventRow-'.length);
  let mission: MissionType = +tr.getAttribute('data-mission-type')!;
  let isReturnFlight = tr.getAttribute('data-return-flight') === 'true';
  let arrivalTime = new Date(+tr.getAttribute('data-arrival-time')! * 1000);

  const cells = tr.cells;
  let isFriendly = cells[0].matches('.friendly');
  let fromName = cells[3].textContent!.trim();
  let fromType = getType(cells[3].querySelector('figure')!.classList);
  let from = parseCoordinates(cells[4].textContent!.trim())!;

  let toName = cells[7].textContent!.trim();
  let toType = getType(cells[7].querySelector('figure')!.classList);
  let to = parseCoordinates(cells[8].textContent!.trim())!;

  let tooltipHolder = cells[6].querySelector('.tooltip')!;
  tooltipHolder.innerHTML = tooltipHolder.getAttribute('title')!;
  let fleet: FleetPartial, cargo: Resources | undefined;
  [fleet, cargo] = parseFleetInfo(tooltipHolder);
  if (cargo.metal === 0 && cargo.crystal === 0 && cargo.deut === 0) cargo = void 0;

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

  let sendMailLink = cells[10].querySelector('a');
  if (sendMailLink) {
    result.targetPlayerId = +sendMailLink.getAttribute('data-playerId')!;
    result.targetPlayerName = sendMailLink.getAttribute('title')!;
  }
  return result;
}

function parseAlliedHeader(tr: HTMLTableRowElement): FlightEvent | undefined {
  return; // TODO
}

function addPartners(main: FlightEvent, partners: HTMLTableRowElement[]): FlightEvent {
  return main;
}

function getType(classList: DOMTokenList): CoordinateType | undefined {
  if (classList.contains('planet')) return void 0 /*CoordinateType.Planet*/; // omit planet type as default
  if (classList.contains('moon')) return CoordinateType.Moon;
  if (classList.contains('tf')) return CoordinateType.Debris;
}

function parseFleetInfo(tooltipHolder: Element): [FleetPartial, Resources] {
  let cells: HTMLTableCellElement[] = [...tooltipHolder.querySelectorAll('td.value')] as HTMLTableCellElement[];
  let data: StringNumberMap = cells.reduce((hash, td: HTMLTableCellElement) => {
        let key = td.previousElementSibling!.textContent!.trim().toLowerCase();
        hash[key.substring(0, key.length - 1)] = parseOnlyNumbers(td.textContent!); // trim ":"
        return hash;
      }, {} as StringNumberMap
  );

  return [
    translateEntries('ships', data, false, false)!,
    translateEntries('resources', data, false, false)!
  ];
}
