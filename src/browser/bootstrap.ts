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
    });

