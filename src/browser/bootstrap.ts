import {ReplyingMessagePort} from '../common/message/ReplyingMessagePort';
import {AutoObserveStub} from '../common/remote/AutoObserveStub';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
      .register('/sw.js', {
        type: 'classic'
      })
      .then(reg => {
        console.log('Registration succeeded. Scope is ' + reg.scope);
      })
      .catch((error) => {
        console.error('Registration failed with ' + error);
      });
} else {
  console.error('Service workers not supported.')
}

if (navigator.serviceWorker.controller) {
  ReplyingMessagePort.connect('exchange', navigator.serviceWorker.controller, navigator.serviceWorker)
      .then(port => {
        const autoObserve = new AutoObserveStub(port);
        (window as any)['autoObserve'] = autoObserve;
      });
}
