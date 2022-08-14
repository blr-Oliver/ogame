import {LoginService} from '../services/infra/LoginService';
import {Fetcher, RequestFacade, ResponseFacade} from './Fetcher';

export class SessionAwareFetcher implements Fetcher {
  private ongoingLogin?: Promise<unknown>;
  private waiters: number = 0;

  constructor(private readonly delegate: Fetcher,
              private readonly loginService: LoginService) {
  }

  async fetch(options: RequestFacade, firstByteOnly?: boolean): Promise<ResponseFacade> {
    if (!('redirect' in options))
      options.redirect = false;
    if (options.redirect)
      return this.delegate.fetch(options, firstByteOnly);
    else {
      const original = this.delegate.fetch(options, firstByteOnly);
      const originalResponse = await original;
      if (this.isLoggedOut(options, originalResponse))
        return await this.retryWithLogin(options, firstByteOnly);
      else
        return original;
    }
  }

  private isLoggedOut(request: RequestFacade, response: ResponseFacade): boolean {
    if (response.status === 302) return true;
    if (true) {
      if (response.headers.has('content-length') &&
          +response.headers.get('content-length')! === 0) return true;
    }
    return false;
  }

  private async retryWithLogin(options: RequestFacade, firstByteOnly?: boolean) {
    console.warn(`Detected closed session, re-logging`);
    if (!this.ongoingLogin) {
      this.waiters = 0; // assert this.waiters === 0
      this.ongoingLogin = this.loginService.doLoginSequence();
    }
    try {
      ++this.waiters;
      await this.ongoingLogin;
      return this.delegate.fetch(options, firstByteOnly);
    } finally {
      if (!--this.waiters) this.ongoingLogin = undefined;
    }
  }
}
