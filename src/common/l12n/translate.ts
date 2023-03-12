import {InfoCategory} from '../../uniplatform/core/types/reports';
import {StringNumberMap} from '../../uniplatform/util/common';
import * as l18n_en from './en.json';

export type TranslationMapping = { [key: string]: string[] };
export type ReverseTranslationMapping = { [key: string]: string };
export type CategorizedTranslationMapping = { [category in InfoCategory]: TranslationMapping };
export type CategorizedReverseTranslationMapping = { [category in InfoCategory]: ReverseTranslationMapping };

export const GLOBAL_TO_LOCAL: CategorizedTranslationMapping = l18n_en;
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
  for (let category in mapping) {
    if (category !== 'default')
      result[category as InfoCategory] = reverseTranslationMapping(mapping[category as InfoCategory]);
  }
  return result as CategorizedReverseTranslationMapping;
}
