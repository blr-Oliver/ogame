import {Fetcher, RequestFacade} from './Fetcher';
import {parallelLimit} from './parallel-limit';

export class NativeFetcher implements Fetcher {
  private readonly limitedFetch: (options: RequestFacade, firstByteOnly?: boolean) => Promise<Response>;

  constructor(maxParallel: number = 8) {
    this.limitedFetch = parallelLimit(NativeFetcher.prototype.doFetch, maxParallel);
  }

  fetch(options: RequestFacade, firstByteOnly?: boolean): Promise<Response> {
    return this.limitedFetch(options, firstByteOnly);
  }

  private doFetch(options: RequestFacade) {
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
