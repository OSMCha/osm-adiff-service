const https = require('https');

const request = async (url, method = 'GET', postData, token) => {
  const [h, ...rest] = url.split('://')[1].split('/');
  const path = `/${rest.join('/')}`;
  const [host, port] = h.split(':');

  const params = {
    method,
    host,
    port: port || url.startsWith('https://') ? 443 : 80,
    path: path || '/',
  };

  if (token && postData) params.headers = {
    Authorization: token,
    'Content-Type': 'application/json',
    'Content-Length' : Buffer.byteLength(postData, 'utf8')
  };


  return new Promise((resolve, reject) => {
    const req = https.request(params, res => {
      if (res.statusCode < 200 || res.statusCode >= 303) {
        return reject(new Error(`Status Code: ${res.statusCode}`));
      }

      const data = [];

      res.on('data', chunk => {
        data.push(chunk);
      });

      res.on('end', () => resolve(Buffer.concat(data).toString()));
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
};

module.exports =  {
  request,
};
