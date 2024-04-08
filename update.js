'use strict';

const { getBothStates, getOverpassTimestamp } = require('./util/get-states');
const { getLastProcessedState, setProcessedState } = require('./util/redis-client');
const { range } = require('./util/range');
const run = require('./index');

const process = async () => {
  const timestamp = await getOverpassTimestamp();
  const planetState = getBothStates(timestamp.replace('\n', '')).planet;
  
  let lastProcessedState = await getLastProcessedState();
  
  if (!lastProcessedState) lastProcessedState = planetState - 2;
  const files = range(lastProcessedState, planetState + 1);
  
  await Promise.all(files.map((i) => run(i)));
  await setProcessedState(planetState + 1);
  console.log(`Processed from ${lastProcessedState} to ${planetState}.`)
};

process();
