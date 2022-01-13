export default null;
declare var self: ServiceWorkerGlobalScope;

function sendCurrentDate() {
  self.clients
      .matchAll({type: 'all'})
      .then((list: readonly Client[]) => {
        if (list.length) {
          let client = list[0];
          client.postMessage(Date.now());
        } else {
          console.log(':\'-(');
        }
      });
}

setInterval(sendCurrentDate, 2000);
