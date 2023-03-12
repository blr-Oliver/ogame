import {ServerContext} from 'ogame-core/context/ServerContext';
import {Fetcher} from '../../core/Fetcher';

const firstSearch = `class="maincontent"`;
const secondSearch = `var token`;
const thirdSearch = `</script>`;

export function getFleetPageResponse(fetcher: Fetcher, serverContext: ServerContext): Promise<string> {
  return fetcher.fetch({
    url: serverContext.gameUrl,
    method: 'GET',
    query: {
      page: 'ingame',
      component: 'fleetdispatch'
    }
  }).then(response => response.text());
}

export function parseFleetPageForConfig(body: string): string {
  const firstIndex = body.indexOf(firstSearch);
  const secondIndex = body.indexOf(secondSearch, firstIndex);
  const thirdIndex = body.indexOf(thirdSearch, secondIndex);

  return body.substring(secondIndex, thirdIndex);
}

const evaluator = new Function('s', `
  with(this) return eval(s);
`);

export function evalFleetConfig(script: string): any {
  script = script.replaceAll('var ', 'this.');
  const context: any = {'$': () => void 0};
  evaluator.call(context, script);
  delete context.$;
  return context;
}
