'use strict';
const moment = require('moment');
const { request } = require('./request');
const { OVERPASS_PRIMARY_URL, OVERPASS_SECONDARY_URL } = require('../lib/constants');


const getStates = (created_at, closed_at) => {
  const start = moment.utc(created_at);

  const states = [];
  const minute = start.startOf('minute');
  while (minute.isBefore(closed_at) || minute.isSame(closed_at)) {
    const nextMinute = minute.add(1, 'minute');
    // echo $(( $( date --date="2017-01-16T15:36:00Z" +%s )/60 - 22457216)), from http://wiki.openstreetmap.org/wiki/Overpass_API/Augmented_Diffs#Deriving_adiff_id_from_time_interval
    const state = (nextMinute.unix() / 60) - 22457216;
    states.push(state);
  }
  return states;
};

const getStateForMinute = (minute) => {
  minute = moment.utc(minute);
  const start = minute.startOf('minute');
  const end = start.add(1, 'minute');
  const state = (end.unix()/60) - 22457216;
  return state;
};

const getOverpassTimestamp = async () => {
  try {
    const timestamp = await request(`${OVERPASS_PRIMARY_URL}/api/timestamp`);
    return timestamp;
  } catch (e) {
    const overpassTimestamp = await request(`${OVERPASS_SECONDARY_URL}/api/timestamp`);
    return overpassTimestamp;
  }
}

// return both the OSM Planet replication file and overpass state for a given minute
const getBothStates = (minute) => {
  minute = moment.utc(minute);
  const start = minute.startOf('minute');
  const overpassState = (start.unix()/60) - 22457216;
  const osmState = overpassState - 46836;
  return { overpass: overpassState, planet: osmState };
};

module.exports = {
  getStates,
  getStateForMinute,
  getBothStates,
  getOverpassTimestamp,
};
