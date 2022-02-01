import {Fetcher, RequestFacade} from './Fetcher';

export class NativeFetcher implements Fetcher {
  fetch(options: RequestFacade, firstByteOnly?: boolean): Promise<Response> {
    let url: string = options.url;
    if (options.query)
      url += `?${(new URLSearchParams(options.query))}`;
    let body;
    if (options.body)
      body = new URLSearchParams(options.body);
    return fetch(new Request(url, {
      method: options.method || 'GET',
      body,
      headers: options.headers,
      redirect: options.redirect ? 'follow' : 'manual'
    }));
  }
}
