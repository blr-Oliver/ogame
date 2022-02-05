import {ReplyingMessagePort} from '../common/message/ReplyingMessagePort';

if ('serviceWorker' in navigator) {
  const url = '/sw.js';
  navigator.serviceWorker
      .register(url, {
        type: 'classic'
      })
      .then(reg => {
        console.log(`Service worker from '${url}' registered. Scope is ${reg.scope}`);
      })
      .catch((error) => {
        console.error('Registration failed with ' + error);
      });
} else {
  console.error('Service workers not supported.')
}

navigator.serviceWorker.ready
    .then(reg => {
      console.log('Page controller is ready');
      const target = reg.active!;
      target.onstatechange = e => console.log(`Controller changed state to ${target.state}`)
      ReplyingMessagePort.connect('exchange', target, reg)
          .then(port => {
            (window as any)['port'] = port;
            console.log(`Port connected`);
          });
      const lockName = 'test-lock';
      navigator.locks
          .request(lockName, {mode: 'exclusive'}, () => new Promise<void>((resolve) => {
            console.log(`Lock '${lockName}' taken by page successfully`);
            resolve();
          }))
          .then(() => {
            console.log(`Lock '${lockName}' released by page`);
          });
    });

