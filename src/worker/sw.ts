function sendCurrentDate() {
  (self as ServiceWorkerGlobalScope)
      .clients.matchAll({type: 'all'})
      .then((list: any[]) => {
        if (list.length) {
          let client = list[0];
          client.postMessage(Date.now());
        } else {
          console.log(':\'-(');
        }
      });
}

setInterval(sendCurrentDate, 2000);

