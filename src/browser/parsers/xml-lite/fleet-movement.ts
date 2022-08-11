import {Document, Element, Text, textContent} from 'my-xml-lite';
import {FleetMovementParser} from '../../../common/parsers';
import {MovingFleet, StringNumberMap} from '../../../common/report-types';
import {translateEntries} from '../../../common/translate';
import {Coordinates, CoordinateType, FleetPartial, MissionType, Resources} from '../../../common/types';
import {parseCoordinates} from '../parsers-common';

export class XmlLiteFleetMovementParser implements FleetMovementParser {
  constructor() {
  }

  parseFleetMovement(body: Document): MovingFleet[] {
    const movement = getMovementComponent(body);
    const fleets = getMovementBlocks(movement);
    return fleets.map(block => parseMovementBlock(block));
  }
}

function getMovementComponent(body: Document): Element {
  return body
      .children[0] // html
      .children[1] // body
      .children.find(e => e.attributes['id'] === 'pageContent')!
      .children.find(e => e.attributes['id'] === 'middle')!
      .children.find(e => e.attributes['id'] === 'movementcomponent')!
      .children[0] // #movement
      .children[0]; // #inhalt
}

function getMovementBlocks(component: Element): Element[] {
  return component.children
      .filter(e => e.attributes['id']?.startsWith('fleet'));
}

function parseMovementBlock(block: Element): MovingFleet {
  /*
  unionId?: number;
  unionName?: string;
   */
  const id = +block.attributes['id']!.substring('fleet'.length);
  const mission: MissionType = +block.attributes['data-mission-type']!;
  const isReturn = block.attributes['data-return-flight'] === '1';
  const arrivalTime = +block.attributes['data-arrival-time']! * 1000;
  const from = getFrom(block.children.find(e => e.attributes['class'] === 'originData')!);
  const to = getTo(block.children.find(e => e.attributes['class'] === 'destinationData')!);
  const fleetTable = block
      .children.find(e => e.attributes['class'] === 'starStreak')!
      .children[0] // ~position:relative
      .children[1] // div.route
      .children[1] // div#bl${id}
      .children[0] // div.htmlTooltip
      .children[2];// table.fleetinfo
  const [fleet, cargo] = getFleetDetails(fleetTable);


  const result: MovingFleet = {
    id, mission, isReturn, arrivalTime, from, to, fleet, cargo
  };
  if (!isReturn) {
    const recallBlock = block.children.find(e => e.attributes['class']?.indexOf('reversal') !== -1);
    if (recallBlock)
      result.recallToken = getToken(recallBlock);
  }
  return result;
}

function getFrom(originData: Element): Coordinates {
  const coordsText = (originData
      .children[0] // span.originCoords
      .children[0] // a
      .childNodes[0] as Text)
      .value.trim();
  const coords = parseCoordinates(coordsText)!;
  const isMoon = originData
      .children[1] // span.originPlanet
      .children[0] // figure.planetIcon
      .attributes['class']!
      .indexOf('moon') !== -1;
  coords.type = isMoon ? CoordinateType.Moon : CoordinateType.Planet;
  return coords;
}

function getCoordinatesType(destPlanetSpan: Element): CoordinateType {
  const wrapperSpan = destPlanetSpan.children.find(e => !e.attributes['class'])!;
  if (wrapperSpan.children.length === 0) return CoordinateType.Planet;
  const figure = wrapperSpan.children[0];
  const figureClass = figure.attributes['class']!;
  if (figureClass.indexOf('moon') !== -1) return CoordinateType.Moon;
  if (figureClass.indexOf('debris') !== -1) return CoordinateType.Debris;
  return CoordinateType.Planet;
}

function getTo(destinationData: Element): Coordinates {
  const coordsText = (destinationData
      .children[1] // span.destinationCoords
      .children[0] // a
      .childNodes[0] as Text)
      .value.trim();
  const coords = parseCoordinates(coordsText)!;
  coords.type = getCoordinatesType(destinationData.children[0]);
  return coords;
}

function getToken(reversal: Element): string {
  const href = reversal
      .children[0]
      .attributes['href']!;
  return href.substring(href.indexOf('token=') + 6);
}

function getFleetDetails(fleetInfo: Element): [FleetPartial, Resources] {
  const rows = fleetInfo.children;
  let i = 0;
  const fleet = parseSection();
  const cargo = parseSection();

  return [
    translateEntries('ships', fleet, false, false)!,
    translateEntries('resources', cargo, false, false)!
  ];

  function parseSection(): StringNumberMap {
    while (!!rows[i++].children[0].attributes['colspan']) ;
    const section: StringNumberMap = {};
    while (i < rows.length && !rows[i].children[0].attributes['colspan']) {
      const name = textContent(rows[i].children[0]).trim().slice(0, -1);
      const count = +textContent(rows[i].children[1]).trim();
      section[name] = count;
      ++i;
    }
    return section;
  }
}