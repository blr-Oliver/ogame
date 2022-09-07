import {Document, Element, NodeContainer, textContent} from 'my-xml-lite';

export function extractGlobalVars(fleetPage: Document): { [key: string]: any } {
  const elements: Element[] = [];
  getElementsByName(fleetPage, 'script', elements);
  const context = prepareContext();
  elements.forEach(script => evalAgainstContext(textContent(script), context));
  cleanContext(context);
  return context;
}

export function extractMetaValues(fleetPage: Document): { [key: string]: string } {
  const elements: Element[] = [];
  getElementsByName(fleetPage, 'meta', elements);
  const data: { [key: string]: string } = {};
  elements.forEach(e => data[e.attributes['name']!] = e.attributes['content']!);
  return data;
}

const evaluator = new Function('s', `
  with(this) return eval(s);
`);

function getElementsByName(parent: NodeContainer, tag: string, list: Element[]) {
  parent.children.forEach(e => {
    if (e.name === tag) {
      list.push(e);
      getElementsByName(e, 'script', list);
    }
  });
}

function prepareContext(): { [key: string]: any } {
  // mock jQuery
  const dummy = () => void 0;
  return {
    $: dummy,
    jQuery: dummy
  };
}

function evalAgainstContext(script: string, context: any) {
  script = script.replaceAll('var ', 'this.');
  evaluator.call(context, script);
}

function cleanContext(context: any) {
  delete context.$;
  delete context.jQuery;
}