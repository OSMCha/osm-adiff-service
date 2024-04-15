'use strict';
const moment = require('moment');
const zlib = require('zlib');
const util = require('util');
const gunzip = util.promisify(zlib.gunzip);
const { REPLICATION_BUCKET, OVERPASS_DELAY, OVERPASS_PRIMARY_URL, OVERPASS_SECONDARY_URL } = require('../lib/constants');
const { s3 } = require('../lib/s3-client');
const { request } = require('./request');


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

const getOverpassDelay = async () => {
  const timestamp = await getOverpassTimestamp();
  return moment.utc().diff(new Date(timestamp.replace('\n', '')), 'minutes') + 1;
}

const getPlanetTimestamp = async () => {
  const overpassDelay = await getOverpassDelay();
  const { Body } = await s3.getObject({
    Bucket: REPLICATION_BUCKET,
    Key: 'planet/replication/minute/state.txt'
  }).promise();
  const state = Body.toString();
  return parseSequenceNumber(state) - overpassDelay;
}

const parseSequenceNumber = (content) => {
  let sequenceNumber;
  content.split('\n').forEach(line => {
    if (line.startsWith('sequenceNumber=')) {
      sequenceNumber = parseInt(line.split('=')[1], 10);
    }
  });
  return sequenceNumber;
}

module.exports = {
  getStates,
  getStateForMinute,
  getOverpassDelay,
  getOverpassTimestamp,
  getPlanetTimestamp,
  parseSequenceNumber,
};
