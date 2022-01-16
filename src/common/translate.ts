import {InfoCategory, StringNumberMap} from './report-types';

export type TranslationMapping = { [key: string]: string[] };
export type ReverseTranslationMapping = { [key: string]: string };
export type CategorizedTranslationMapping = { [category in InfoCategory]: TranslationMapping };
export type CategorizedReverseTranslationMapping = { [category in InfoCategory]: ReverseTranslationMapping };

export const GLOBAL_TO_LOCAL: CategorizedTranslationMapping = {
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
export const LOCAL_TO_GLOBAL: CategorizedReverseTranslationMapping = reverseCategorizedMapping(GLOBAL_TO_LOCAL);

export function translateEntries<T /*extends StringNumberMap*/>(category: InfoCategory, local?: StringNumberMap, padEntries: boolean = true, keepUnknown: boolean = true): T | undefined {
  if (local) {
    const result: StringNumberMap = {};
    const reversedMapping = LOCAL_TO_GLOBAL[category];

    for (let localKey in local) {
      let newKey = reversedMapping[localKey.toLowerCase()];
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

export function reverseTranslationMapping(categoryTranslation: TranslationMapping): ReverseTranslationMapping {
  let reversedMapping: ReverseTranslationMapping = {};
  for (let term in categoryTranslation) {
    for (let translation of categoryTranslation[term])
      reversedMapping[translation] = term;
  }
  return reversedMapping;
}
export function reverseCategorizedMapping(mapping: CategorizedTranslationMapping): CategorizedReverseTranslationMapping {
  let result: { [category in InfoCategory]?: ReverseTranslationMapping } = {};
  for (let category in mapping)
    result[category as InfoCategory] = reverseTranslationMapping(mapping[category as InfoCategory]);
  return result as CategorizedReverseTranslationMapping;
}
