import {ServerContext} from 'ogame-core/context/ServerContext';
import {Fetcher, RequestFacade} from '../../core/Fetcher';

export class LoginService {
  constructor(
      private readonly self: ServiceWorkerGlobalScope,
      private readonly server: ServerContext,
      private readonly fetcher: Fetcher) {
  }

  async getAuthToken(): Promise<string | undefined> {
    //@ts-ignore
    return this.self.cookieStore.get('gf-token-production').then(cookie => cookie && cookie.value);
  }

  getPreLoginRequest(token: string): RequestFacade {
    return {
      url: `https://${this.server.domain}/lobby/api/users/me/loginLink`,
      method: 'GET',
      query: { // TODO bind to context
        id: 117033,
        'server[language]': 'en',
        'server[number]': 156,
        'clickedButton': 'account_list'
      },
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      redirect: false
    };
  }

  getLoginUrl(request: RequestFacade): Promise<string> {
    return this.fetcher
        .fetch(request)
        .then(response => response.json())
        .then(data => data['url']);
  }

  async makeLoginRequest(loginUrl: string, token: string): Promise<unknown> {
    return this.fetcher.fetch({
      url: loginUrl,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      redirect: false
    }, true);
  }

  async doLoginSequence(): Promise<unknown> {
    const token = await this.getAuthToken();
    if (!token)
      throw new Error('no saved gf-production-token available');
    const loginUrl = await this.getLoginUrl(this.getPreLoginRequest(token));
    return this.makeLoginRequest(loginUrl, token);
  }
}
