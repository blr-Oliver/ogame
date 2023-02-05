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
    if (e.name === tag)
      list.push(e);
    getElementsByName(e, tag, list);
  });
}

function prepareContext(): { [key: string]: any } {
  // mock everything
  function dummy() {
  }
  function $dummy() {
    return {
      ready: dummy,
      bind: dummy
    }
  }
  const context: { [key: string]: any } = {
    $: $dummy,
    jQuery: $dummy,
    'TimerHandler': dummy,
    'baulisteCountdown': dummy,
    'eventboxCountdown': dummy,
    'initStandardFleet': dummy,
    'initIndex': dummy,
    'ogame': {
      chat: {
        showPlayerList: dummy
      }
    },
    'window': {
      setInterval: dummy
    },
    'document': {
      addEventListener: dummy
    }
  };
  context['reloadResources'] = (x: any) => context['$reloadResources'] = x;
  return context;
}

function evalAgainstContext(script: string, context: any) {
  script = script.replaceAll('var ', 'this.');
  script = script.replaceAll('let ', 'this.');
  script = script.replaceAll('const ', 'this.');
  evaluator.call(context, script);
}

function cleanContext(context: any) {
  delete context.$;
  delete context.jQuery;
  delete context['TimerHandler'];
  delete context['baulisteCountdown'];
  delete context['eventboxCountdown'];
  delete context['initStandardFleet'];
  delete context['initIndex'];
  delete context['ogame'];
  delete context['window'];
  delete context['document'];
  delete context['reloadResources'];
}