const fetch = require('node-fetch');
const { version } = require("../package.json");

async function request(url, options = {}) {
  if (!options.headers) {
    options.headers = {}
  }

  options.headers['User-Agent'] = `OSMCha osm-adiff-service ${version}`

  let res = await fetch(url, options);

  if (res.ok) {
    return res;
  } else {
    let error = new Error(`HTTP ${res.status} ${res.statusText}`);
    error.status = res.status;
    error.statusText = res.statusText;
    throw error;
  }
}

module.exports =  { request };
