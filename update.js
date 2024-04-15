'use strict';

const { getPlanetTimestamp } = require('./util/get-states');
const { getLastProcessedState, setProcessedState } = require('./util/redis-client');
const { range } = require('./util/range');
const run = require('./index');

const process = async () => {
  const planetState = await getPlanetTimestamp();
  
  let lastProcessedState = await getLastProcessedState();
  
  if (!lastProcessedState) lastProcessedState = planetState - 2;
  const files = range(lastProcessedState, planetState + 1);
  
  for (const f of files) {
    await run(f);
    await setProcessedState(f);
  }
  console.log(`Processed from ${lastProcessedState} to ${planetState}.`)
};

process();
