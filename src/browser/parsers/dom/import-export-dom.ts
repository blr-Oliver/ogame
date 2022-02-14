import {map} from '../../../common/common';
import {PlanetListParser, PlanetResourcesParser} from '../../../common/parsers';
import {CoordinateType, Resources, SpaceBody} from '../../../common/types';
import {parseImportExportScriptForResources} from '../no-dom/import-export-no-dom';
import {parseCoordinates} from '../parsers-common';
import {HtmlParser} from './HtmlParser';

export class DOMImportExportParser implements PlanetListParser, PlanetResourcesParser {
  constructor(private readonly htmlParser: HtmlParser) {
  }

  parsePlanetList(body: string): SpaceBody[] {
    return parseImportExportForPlanetList(this.htmlParser.parse(body));
  }
  parseResources(body: string): { [p: number]: Resources } {
    return parseImportExportForResources(this.htmlParser.parse(body));
  }
}

export function parseImportExportForResources(doc: ParentNode): { [id: number]: Resources } {
  let scriptContainer = doc.querySelector('.footer')!.nextElementSibling!;
  return parseImportExportScriptForResources(scriptContainer.textContent!);
}

export function parseImportExportForPlanetList(doc: ParentNode): SpaceBody[] {
  let listHolder = doc.querySelector('#js_togglePanelImportExport')!;
  return [
    ...parseBodies(CoordinateType.Planet, listHolder.querySelectorAll('ul.planet>li')),
    ...parseBodies(CoordinateType.Moon, listHolder.querySelectorAll('ul.moon>li'))
  ];
}

function parseBodies(type: CoordinateType, items: NodeListOf<Element>): SpaceBody[] {
  return map(items, (item: Element) => parseBody(type, item));
}

function parseBody(type: CoordinateType, item: Element): SpaceBody {
  const id = +item.id;
  const name = item.querySelector('img')!.getAttribute('alt')!;
  const planetText = item.querySelector('span')!.textContent!;
  const coordinates = parseCoordinates(planetText.slice(name.length + 1).trim())!;
  return {
    id,
    name,
    coordinates: {
      ...coordinates,
      type
    }
  };
}
