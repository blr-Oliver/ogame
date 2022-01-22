export class PageRadio {
  constructor() {
  }
  sendMessage(data: any) {
    let controller = navigator.serviceWorker.controller;
    if (controller) {
      controller.postMessage(data);
    } else {
      console.log('Controller is not connected');
    }
  }
}
