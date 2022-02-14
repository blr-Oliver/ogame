import {readAttribute} from '../parsers-common';

const contentStartMarker = `<div id="technologies">`;
const blockStartMarker = `<li class="technology`;
const blockIdMarker = `data-technology=`;
const blockValueMarker = `<span class="level" data-value=`;

export function parseResearchPage(body: string): { [researchId: number]: number } {
  let result: { [researchId: number]: number } = {};
  let currentPosition = body.indexOf(contentStartMarker) + contentStartMarker.length;
  let blockStart: number;
  while ((blockStart = body.indexOf(blockStartMarker, currentPosition)) != -1) {
    currentPosition = blockStart + blockStartMarker.length;
    currentPosition = body.indexOf(blockIdMarker, currentPosition);
    currentPosition += blockIdMarker.length;
    let techId = +readAttribute(body, currentPosition);
    currentPosition = body.indexOf(blockValueMarker, currentPosition);
    currentPosition += blockValueMarker.length;
    result[techId] = +readAttribute(body, currentPosition);
  }
  return result;
}

