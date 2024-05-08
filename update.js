'use strict';
const { getPlanetTimestamp } = require('./util/get-states');
const { getLastProcessedState, setProcessedState, storePendingReplications, getReplicationToProcess } = require('./util/redis-client');
const { range } = require('./util/range');
const run = require('./index');
const { NUM_WORKERS } = require('./lib/constants');

// Check the queue and pick a file to process
const processReplication = async () => {
  let toProcess = await getReplicationToProcess();
  while (toProcess) {
    // avoid decreasing the lastProcessedState value
    let lastProcessedState = await getLastProcessedState();
    if (lastProcessedState < toProcess) {
      await setProcessedState(toProcess);
    }
    console.log(`Processing replication file ${toProcess}`);
    await run(toProcess);
    console.log(`Finished processing replication file ${toProcess}`);
    toProcess = await getReplicationToProcess();
  }
};

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

  await Promise.all(
    Array(Number(NUM_WORKERS)).fill().map(
      async () => await processReplication()
  ));
};

process();
