fetch('https://cms.asisten-guru.my.id/api/auth/login', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://admin.asisten-guru.my.id',
    'Access-Control-Request-Method': 'POST'
  }
}).then(r => {
  console.log('CORS Origin:', r.headers.get('access-control-allow-origin'));
  console.log('Status:', r.status);
}).catch(console.error);
