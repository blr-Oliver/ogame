import {Fetcher, RequestFacade, ResponseFacade} from './Fetcher';
import {parallelLimit} from './FloodGate';

export class RestrainedFetcher implements Fetcher {
  static readonly DEFAULT_LIMIT = 8;
  private readonly wrapper: (options: RequestFacade, firstByteOnly?: boolean) => Promise<ResponseFacade>;

  constructor(public readonly delegate: Fetcher,
              public readonly limit: number = RestrainedFetcher.DEFAULT_LIMIT) {
    this.wrapper = parallelLimit(delegate.fetch.bind(delegate), limit);
  }

  fetch(options: RequestFacade, firstByteOnly?: boolean): Promise<ResponseFacade> {
    return this.wrapper(options, firstByteOnly);
  }
}
