export interface RequestCapture {
  request: Request;
  response: Response;
}

export function spyRequest(e: FetchEvent): Promise<RequestCapture> {
  return new Promise<RequestCapture>((resolve, reject) => {
    let reqClone = e.request.clone(), resClone: Response;
    let responsePromise = fetch(e.request).then(response => {
      resClone = response.clone();
      return response;
    });
    responsePromise
        .then(() => resolve({
          request: reqClone,
          response: resClone
        }))
        .catch(e => reject(e));
    e.respondWith(responsePromise);
  });
}
