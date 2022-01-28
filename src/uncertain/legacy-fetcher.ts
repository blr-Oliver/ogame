import * as request from 'request';
import {Fetcher, RequestOptions} from './LegacyMapper';

export class LegacyFetcher implements Fetcher {
  fetch(options: RequestOptions, firstByteOnly?: boolean): Promise<request.Response> {
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
          resolve(response);
        });
        req.on('error', reject);
      });
    else
      return new Promise((resolve, reject) => {
        request(opts, (error, response) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
  }
}
