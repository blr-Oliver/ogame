navigator.serviceWorker.addEventListener('message', event => {
  console.log(`The service worker sent a message: ${new Date(event.data)}`);
});
