import {Fetcher} from '../../core/Fetcher';
import {ServerContext} from '../../../uniplatform/core/ServerContext';
import {CoordinateType, Resources, SpaceBody} from '../../../uniplatform/core/types/core';
import {parseCoordinates} from '../parsers-common';
import {readAttribute} from './no-dom-common';

export function getImportExportResponse(fetcher: Fetcher, serverContext: ServerContext): Promise<string> {
  return fetcher.fetch({
    url: serverContext.gameUrl,
    method: 'POST',
    query: {
      page: 'ajax',
      component: 'traderimportexport'
    },
    body: {
      show: 'importexport',
      ajax: 1
    },
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  }).then(response => response.text());
}

export function getImportExportRefreshResponse(fetcher: Fetcher, serverContext: ServerContext, planetId: number, token?: string): Promise<any> {
  if (!token) return getImportExportRefreshResponse(fetcher, serverContext, planetId, '01234567012345670123456701234567')
      .then(json => getImportExportRefreshResponse(fetcher, serverContext, planetId, json.newAjaxToken));

  return fetcher.fetch({
    url: serverContext.gameUrl,
    method: 'POST',
    query: {
      page: 'ajax',
      component: 'traderimportexport',
      action: 'refreshPlanet',
      ajax: 1,
      asJson: 1
    },
    body: {
      planetId,
      token,
      ajax: 1
    },
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  }).then(response => response.json());
}

const resourcesMarkers = {
  flier: `class="footer"`,
  start: `var planetResources`,
  end: `</script>`,
  prefix: `
(function() {
  var traderObj = {initImportExport: () => void 0};
  var initThousandSeparator = () => void 0;
`,
  suffix: `
return planetResources; })()`
}

export function parseImportExportForResources(body: string): { [planetId: number]: Resources } {
  const {flier, start, end} = resourcesMarkers;
  const firstIndex = body.indexOf(flier);
  const secondIndex = body.indexOf(start, firstIndex);
  const thirdIndex = body.indexOf(end, secondIndex);

  const script = body.substring(secondIndex, thirdIndex);
  return parseImportExportScriptForResources(script);
}

export function parseImportExportScriptForResources(script: string) {
  const {prefix, suffix} = resourcesMarkers;
  const data = eval(prefix + script + suffix);
  return Object.keys(data).reduce((result, id) => (result[+id] = data[id].input, result), {} as { [id: number]: Resources });
}

const bodiesMarkers = {
  flier: `<div id="js_togglePanelImportExport"`,
  planetList: `<ul class="planet`,
  moonList: `<ul class="moon`,
  body: `<li id=`,
  id: `data-planetId`,
  name: `<img alt=`,
  coordsStart: `<span class="option_source">`,
  coordsEnd: `</span>`
}

export function parseImportExportForBodies(body: string): SpaceBody[] {
  const flierIndex = body.indexOf(bodiesMarkers.flier);
  let planetStart = body.indexOf(bodiesMarkers.planetList, flierIndex);
  let moonStart = body.indexOf(bodiesMarkers.moonList, flierIndex);
  let planets, moons: SpaceBody[];
  if (moonStart === -1) {
    planets = parseBodies(body, CoordinateType.Planet, planetStart);
    moons = [];
  } else {
    planets = parseBodies(body, CoordinateType.Planet, planetStart, moonStart);
    moons = parseBodies(body, CoordinateType.Moon, moonStart);
  }
  for (let moon of moons)
    for (let planet of planets)
      if (isCompanion(planet, moon)) {
        planet.companion = moon;
        moon.companion = planet;
        break;
      }
  return planets.concat(moons);
}

function parseBodies(body: string, type: CoordinateType, position: number, end: number = Infinity): SpaceBody[] {
  let bodyBlockStart = position;
  let result: SpaceBody[] = [];
  while ((bodyBlockStart = body.indexOf(bodiesMarkers.body, bodyBlockStart)) !== -1 && bodyBlockStart < end) {
    bodyBlockStart += bodiesMarkers.body.length;
    result.push(parseBody(body, type, bodyBlockStart));
  }
  return result;
}

function parseBody(body: string, type: CoordinateType, position: number): SpaceBody {
  let idPosition = body.indexOf(bodiesMarkers.id, position);
  let id = +readAttribute(body, idPosition + bodiesMarkers.id.length);
  let namePosition = body.indexOf(bodiesMarkers.name, position);
  let name = readAttribute(body, namePosition + bodiesMarkers.name.length).trim();
  let coordsStart = body.indexOf(bodiesMarkers.coordsStart, position) + bodiesMarkers.coordsStart.length;
  let coordsEnd = body.indexOf(bodiesMarkers.coordsEnd, position);
  let coordsText = body.substring(coordsStart, coordsEnd).trim();
  let coords = parseCoordinates(coordsText.substring(coordsText.lastIndexOf('[')))!;
  return {
    id,
    name,
    coordinates: {
      ...coords,
      type
    }
  };
}

function isCompanion(planet: SpaceBody, moon: SpaceBody): boolean {
  return planet.coordinates.galaxy === moon.coordinates.galaxy &&
      planet.coordinates.system === moon.coordinates.system &&
      planet.coordinates.position === moon.coordinates.position;
}
