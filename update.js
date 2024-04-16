'use strict';

const { getPlanetTimestamp } = require('./util/get-states');
const { getLastProcessedState, setProcessedState, storePendingReplications, getReplicationToProcess } = require('./util/redis-client');
const { range } = require('./util/range');
const run = require('./index');

const process = async () => {
  // check if there are any files to process and queue them
  const planetState = await getPlanetTimestamp();
  
  let lastProcessedState = await getLastProcessedState();
  
  if (!lastProcessedState) lastProcessedState = planetState - 2;
  const files = range(lastProcessedState, planetState + 1);
  console.log(`Queueing replication files from ${lastProcessedState} to ${planetState} to process.`);

  await Promise.all(files.map(async (f) => {
    await storePendingReplications(f);
  }));

  // Now check the queue and pick a file to process
  let toProcess = await getReplicationToProcess();
  while (toProcess) {
    console.log(`Processing replication file ${toProcess}`);
    await run(toProcess);
    console.log(`Finished processing replication file ${toProcess}`);
    await setProcessedState(toProcess);
    toProcess = await getReplicationToProcess();
  }
};

process();
