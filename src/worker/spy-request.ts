export type RequestCapture = { request: Request };
export type FullCapture = RequestCapture & { response: Response };

export function spyRequest(e: FetchEvent, cloneRequest?: boolean): Promise<FullCapture>;
export function spyRequest(e: FetchEvent, cloneRequest: boolean, captureResponse: true, cloneResponse?: boolean): Promise<FullCapture>;
export function spyRequest(e: FetchEvent, cloneRequest: boolean, captureResponse: false): Promise<RequestCapture>;
export function spyRequest(e: FetchEvent, cloneRequest: boolean, captureResponse?: boolean, cloneResponse?: boolean): Promise<RequestCapture | FullCapture>;
export function spyRequest(e: FetchEvent, cloneRequest: boolean = true, captureResponse: boolean = true, cloneResponse: boolean = captureResponse): Promise<RequestCapture | FullCapture> {
  return new Promise((resolve, reject) => {
    let reqResult = cloneRequest ? e.request.clone() : e.request;
    let responsePromise = fetch(e.request);
    if (!captureResponse) {
      e.respondWith(fetch(e.request));
      resolve({
        request: reqResult
      });
    } else {
      responsePromise.then(response => resolve({
        request: reqResult,
        response: cloneResponse ? response.clone() : response
      }), error => reject(error));
      e.respondWith(responsePromise);
    }
  });
}
