import {IncomingHttpHeaders} from 'http';
import * as request from 'request';
import {Cookie, CookieJar, MemoryCookieStore} from 'tough-cookie';
import {Fetcher, HeadersFacade, RequestFacade, ResponseFacade} from '../common/core/Fetcher';
import {LegacyMapper} from '../uncertain/LegacyMapper';

export class LegacyFetcher implements Fetcher {
  readonly jar: CookieJar;
  readonly requestJar: request.CookieJar;

  static blacklistCookie: { [key: string]: boolean } = {
    tabBoxFleets: true,
    visibleChats: true,
    maximizeId: true,
    __auc: true,
    __asc: true,
    _ga: true,
    _gid: true,
    _fbp: true
  };

  constructor() {
    const cookieStore = new MemoryCookieStore();
    this.jar = new CookieJar(cookieStore);
    this.requestJar = request.jar(cookieStore);
    request.defaults({
      jar: this.requestJar
    });
  }

  fetch(options: RequestFacade, firstByteOnly?: boolean): Promise<ResponseFacade> {
    let opts = {
      url: options.url,
      method: options.method,
      qs: options.query,
      form: options.body,
      headers: options.headers,
      followRedirect: options.redirect
    };
    if (firstByteOnly)
      return new Promise((resolve, reject) => {
        let req = request(opts);
        req.on('response', response => {
          req.destroy();
          resolve(new LegacyResponseWrapper(response));
        });
        req.on('error', reject);
      });
    else
      return new Promise((resolve, reject) => {
        request(opts, (error, response) => {
          if (error) reject(error);
          else resolve(new LegacyResponseWrapper(response));
        });
      });
  }

  useCookie(cookieString: string | string[], domain: string = LegacyMapper.GAME_DOMAIN) {
    // TODO this is related only to cookieJar and legacy fetcher; should move this there
    if (typeof (cookieString) === 'string')
      cookieString = [cookieString];
    if (cookieString) {
      for (let item of cookieString) {
        let cookies = item.split(/;\s*/);
        for (let cookie of cookies) {
          let parsed = Cookie.parse(cookie);
          if (parsed && !LegacyFetcher.blacklistCookie[parsed.key]) {
            this.requestJar.setCookie(cookie, domain);
          }
        }
      }
    }
  }
}

class LegacyResponseWrapper implements ResponseFacade {
  private headerWrapper?: HeadersFacade;

  constructor(private readonly response: request.Response) {
  }
  get status() {
    return this.response.statusCode;
  }
  get bodyUsed() {
    return false;
  }
  get statusText() {
    return this.response.statusMessage;
  }
  get url() {
    return this.response.url!;
  }
  get headers(): HeadersFacade {
    return this.headerWrapper ?? (this.headerWrapper = new LegacyHeadersWrapper(this.response.headers));
  }
  clone(): ResponseFacade {
    return new LegacyResponseWrapper(this.response);
  }
  json(): Promise<any> {
    return Promise.resolve(JSON.parse(this.response.body));
  }
  text(): Promise<string> {
    return Promise.resolve(this.response.body);
  }
}

class LegacyHeadersWrapper implements HeadersFacade {
  constructor(private headers: IncomingHttpHeaders) {
  }
  get(name: string): string | null {
    let value = this.headers[name];
    return value ? String(value) : null;
  }
  has(name: string): boolean {
    return name in this.headers;
  }
  forEach(callback: (value: string, key: string, parent: HeadersFacade) => void, thisArg?: any): void {
    Object.keys(this.headers).forEach(key => callback(String(this.headers[key]), key, this), thisArg);
  }
}
