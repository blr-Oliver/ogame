import {map} from '../../common/common';
import {StampedEspionageReport} from '../../common/types';
import {parseLocalDate, parseOnlyNumbers} from './parsers-common';

export interface StringNumberMap {
  [key: string]: number;
}

export type InfoCategory = 'resources' | 'ships' | 'defense' | 'buildings' | 'research';
export type TranslationMapping = { [key: string]: string[] };
export type ReverseTranslationMapping = { [key: string]: string };

export const GLOBAL_TO_LOCAL: { [category: string]: TranslationMapping } = {
  resources: {
    metal: ['металл'],
    crystal: ['кристалл'],
    deut: ['дейтерий'],
    energy: ['энергия']
  },
  ships: {
    lightFighter: ['лёгкий истребитель', 'легкий истребитель'],
    heavyFighter: ['тяжёлый истребитель', 'тяжелый истребитель'],
    cruiser: ['крейсер'],
    battleship: ['линкор'],
    battlecruiser: ['линейный крейсер'],
    bomber: ['бомбардировщик'],
    destroyer: ['уничтожитель'],
    deathStar: ['звезда смерти'],
    smallCargo: ['малый транспорт'],
    largeCargo: ['большой транспорт'],
    colonyShip: ['колонизатор'],
    recycler: ['переработчик'],
    espionageProbe: ['шпионский зонд'],
    solarSatellite: ['солнечный спутник']
  },
  defense: {
    rocketLauncher: ['ракетная установка'],
    lightLaser: ['лёгкий лазер', 'легкий лазер'],
    heavyLaser: ['тяжёлый лазер', 'тяжелый лазер'],
    ionCannon: ['ионное орудие'],
    gaussCannon: ['пушка гаусса'],
    plasmaTurret: ['плазменное орудие'],
    smallShield: ['малый щитовой купол'],
    largeShield: ['большой щитовой купол'],
    antiBallistic: ['ракета-перехватчик'],
    interplanetary: ['межпланетная ракета']
  },
  buildings: {
    metalMine: ['рудник по добыче металла'],
    crystalMine: ['рудник по добыче кристалла'],
    deutMine: ['синтезатор дейтерия'],
    metalStorage: ['хранилище металла'],
    crystalStorage: ['хранилище кристалла'],
    deutStorage: ['ёмкость для дейтерия', 'емкость для дейтерия'],
    solarPlant: ['солнечная электростанция'],
    fusionReactor: ['термоядерная электростанция'],
    robotics: ['фабрика роботов'],
    nanite: ['фабрика нанитов'],
    shipyard: ['верфь'],
    researchLab: ['исследовательская лаборатория'],
    terraformer: ['терраформер'],
    allianceDepot: ['склад альянса'],
    missileSilo: ['ракетная шахта'],
    spaceDock: ['космический док'],
    lunarBase: ['лунная база'],
    sensorPhalanx: ['сенсорная фаланга'],
    jumpGate: ['ворота']
  },
  research: {
    energy: ['энергетическая технология'],
    laser: ['лазерная технология'],
    ion: ['ионная технология'],
    hyperspace: ['гиперпространственная технология'],
    plasma: ['плазменная технология'],
    espionage: ['шпионаж'],
    computer: ['компьютерная технология'],
    astrophysics: ['астрофизика'],
    intergalactic: ['межгалактическая исследовательская сеть'],
    graviton: ['гравитационная технология'],
    combustionDrive: ['реактивный двигатель'],
    impulseDrive: ['импульсный двигатель'],
    hyperspaceDrive: ['гиперпространственный двигатель'],
    weaponsUpgrade: ['оружейная технология'],
    shieldingUpgrade: ['щитовая технология'],
    armorUpgrade: ['броня космических кораблей']
  }
};

export const LOCAL_TO_GLOBAL: { [category: string]: ReverseTranslationMapping } = reverseMapping(GLOBAL_TO_LOCAL);

export function parseReportList(doc: DocumentFragment): number[] {
  return map(doc.querySelectorAll('li[data-msg-id]')!, (el: Element) => +el.getAttribute('data-msg-id')!);
}

export function parseReport(doc: DocumentFragment): StampedEspionageReport | undefined {
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

  let [metal, crystal, deut, energy] = map(resourceBlock!.querySelectorAll('.res_value'),
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
    resources: {
      metal,
      crystal,
      deut,
      energy
    },
    fleet: translateEntries('ships', fleetInfo),
    defense: translateEntries('defense', defenseInfo),
    buildings: translateEntries('buildings', buildingInfo),
    researches: translateEntries('research', researchInfo)
  };
}
export function translateEntries<T>(category: InfoCategory, local?: StringNumberMap, padEntries: boolean = true, keepUnknown: boolean = true): T | undefined {
  if (local) {
    const mapping = LOCAL_TO_GLOBAL[category];
    const result: StringNumberMap = {};

    for (let localKey in local) {
      let newKey = mapping[localKey.toLowerCase()];
      if (newKey)
        result[newKey] = local[localKey];
      else if (keepUnknown)
        result[localKey] = local[localKey];
    }

    if (padEntries) {
      for (let globalKey in GLOBAL_TO_LOCAL[category])
        if (!(globalKey in result))
          result[globalKey] = 0;
    }
    return <T>(result as any);
  }
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

function reverseMapping(mapping: { [category: string]: TranslationMapping }): { [category: string]: ReverseTranslationMapping } {
  let result: { [category: string]: ReverseTranslationMapping } = {};
  for (let category in mapping) {
    let categoryTranslation = mapping[category];
    let reversedMapping: ReverseTranslationMapping = result[category] = {};
    for (let globalKey in categoryTranslation) {
      for (let translation of categoryTranslation[globalKey])
        reversedMapping[translation] = globalKey;
    }
  }
  return result;
}
