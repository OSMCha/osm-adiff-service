const { createClient } = require('redis');
const { REDIS_SERVER } = require('../lib/constants');

const setProcessedState = async (value) => {
  const client = await createClient(REDIS_SERVER)
    .on('error', err => console.log('Redis Client Error', err))
    .connect();
  
  await client.set('state', value);
  await client.disconnect();
};

const getLastProcessedState = async () => {
  const client = await createClient(REDIS_SERVER)
    .on('error', err => console.log('Redis Client Error', err))
    .connect();
  
  const lastState = await client.get('state');
  await client.disconnect();
  return Number(lastState);
};

module.exports = {
  setProcessedState,
  getLastProcessedState,
};