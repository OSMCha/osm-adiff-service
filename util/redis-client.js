const { createClient } = require('redis');
const { REDIS_SERVER } = require('../lib/constants');

const REDIS_CONFIG = REDIS_SERVER ? { url: REDIS_SERVER } : null;

const setProcessedState = async (value) => {
  const client = await createClient(REDIS_CONFIG)
    .on('error', err => { throw err })
    .connect();
  
  await client.set('adiff-service:state', value);
  await client.disconnect();
};

const storePendingReplications = async (value) => {
  const client = await createClient(REDIS_CONFIG)
    .on('error', err => { throw err })
    .connect();
  
  await client.zAdd('adiff-service:pending_replications_sorted', {value: `${value}`, score: value});
  await client.disconnect();
};

const getReplicationToProcess = async () => {
  const client = await createClient(REDIS_CONFIG)
    .on('error', err => { throw err })
    .connect();
  
  const replication = await client.zPopMin('adiff-service:pending_replications_sorted');
  await client.disconnect();
  return replication ? Number(replication.value) : null;
};

const getLastProcessedState = async () => {
  const client = await createClient(REDIS_CONFIG)
    .on('error', err => { throw err })
    .connect();
  
  const lastState = await client.get('adiff-service:state');
  await client.disconnect();
  return Number(lastState);
};

module.exports = {
  setProcessedState,
  storePendingReplications,
  getReplicationToProcess,
  getLastProcessedState,
};
