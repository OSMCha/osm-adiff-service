'use strict';
const _ = require('lodash');
const moment = require('moment');

const { parseXml, parseChangesetXml, parseAugmentedDiff } = require('../lib/xml');
const { getStateForMinute } = require('../util/get-states');
const { request } = require('../util/request');
const {
  OSM_CHANGESET_API,
  CHANGE_STATES,
  TYPES,
  OVERPASS_PRIMARY_URL,
  OVERPASS_SECONDARY_URL
} = require('./constants');

const getChangesets = async (xml) => {
  const jsonData = parseXml(xml);

  if (!jsonData.osmChange || !jsonData.osmChange[0]) {
    throw new Error('OSM data missing from XML file');
  }

  const { timestamps, changesetIds, featureMap } = parseJsonData(jsonData);

  console.log(`Timestamps found: ${timestamps.length}`);
  console.log(`Changesets found: ${changesetIds.length}`);

  const states = getTimestampsStates(timestamps);

  console.log('States: ', states);

  const max = states.sort()[states.length - 1];

  try {
    await checkLatest(max);
  } catch (e) {
    console.log('Error in checkLatest:', e);
    process.exit(1);
  }

  console.log('CHANGESET IDS: ', changesetIds);

  const results = await changesetIds.reduce(async (memo, changesetId) => {
    const memoVal = await memo;

    const meta = await getChangesetMetadata(changesetId);
    const augmentedDiffXml = await queryOverpass(
        changesetId,
        getDataParam(
          meta.created_at,
          meta.closed_at ? meta.closed_at : meta.created_at,
          meta.open === 'false'
        ),
        getBboxParam(meta.bbox)
      );

    const parsed = parseAugmentedDiff(augmentedDiffXml);

    const elements = Object.keys(parsed).reduce(
      (result, item) => {
        if(parseInt(item, 10) <= parseInt(changesetId, 10)) {
          return result.concat(parsed[item]);
        }

        return result;
      },
      []
    );

    if(! memoVal[changesetId]) {
      memoVal[changesetId] = {};
    }

    memoVal[changesetId].elements = elements;
    memoVal[changesetId].metadata = meta;

    return memoVal;
  }, Promise.resolve({}));

  const realFeatureMap = {};

  for (const id in results) {
    results[id].elements.forEach((f) => {
      if (!realFeatureMap[id]) {
        realFeatureMap[id] = [];
      }
      realFeatureMap[id].push(f.id);
    });
  }

  const diffFeatureMap = {};
  changesetIds.forEach((cid) => {
    if (featureMap[cid] && realFeatureMap[cid]) {
      diffFeatureMap[cid] = _.difference(featureMap[cid], realFeatureMap[cid]);
      if (diffFeatureMap[cid].length) {
        results[cid].metadata.incomplete = true;
        console.log('# Incomplete changeset', cid);
      }
    }
  });

  console.log('# Feature diff', JSON.stringify(diffFeatureMap));

  return results;
};

const parseJsonData = (jsonData) => {
  const featureMap = {};
  let timestamps = [];
  let changesetIds = [];

  CHANGE_STATES.map((changeState) => {
    if(jsonData.osmChange[0][changeState]) {
      jsonData.osmChange[0][changeState].forEach((stateSection) => {
        TYPES.forEach((type) => {
          if(stateSection[type]) {
            stateSection[type].forEach(({ timestamp, changeset, id }) => {
              timestamps.push(timestamp);
              changesetIds.push(changeset);

              if (!featureMap[changeset]) {
                featureMap[changeset] = [];
              }
              featureMap[changeset].push(id);
            })
          }
        });
      });
    }
  });

  timestamps = _.uniq(timestamps);
  changesetIds = _.uniq(changesetIds);

  return {
    timestamps,
    changesetIds,
    featureMap,
  };
};

const getTimestampsStates = (timestamps) => {
  return _.uniq(timestamps.map((timestamp) => getStateForMinute(timestamp)));
};

const queryOverpass = async (changesetId, data, bbox) => {
  const primaryUrl = `${OVERPASS_PRIMARY_URL}/api/interpreter?data=${data}&bbox=${bbox}`;
  const secondaryUrl = `${OVERPASS_SECONDARY_URL}/api/interpreter?data=${data}&bbox=${bbox}`;

  try {
    console.log(`Trying primary overpass for changeset ${changesetId}: ${primaryUrl}`);
    return await request(primaryUrl).then(res => res.text());
  } catch (e) {
    console.log('Primary overpass error: ', e);
    console.log(`Primary overpass failed, trying secondary for changeset ${changesetId}: ${secondaryUrl}`);
    try {
      return await request(secondaryUrl).then(res => res.text());
    } catch (e) {
      throw new Error(`Primary and secondary Overpass failed for changeset ${changesetId}: ${e}`);
    }
  }
};

const getChangesetMetadata = async (changesetId) => {
  try {
    const body = await request(`${OSM_CHANGESET_API}/${changesetId}`).then(res => res.text());
    const changesetData = parseChangesetXml(body);

    const meta = changesetData.osm[0].changeset[0];

    const bbox = {
      left: meta.min_lon ? meta.min_lon : -180,
      bottom: meta.min_lat ? meta.min_lat : -90,
      right: meta.max_lon ? meta.max_lon : 180,
      top: meta.max_lat ? meta.max_lat : 90
    };

    meta.bbox = bbox;

    return meta;

  } catch (e) {
    throw e;
  }
};

const checkLatest = async (max) => {
  const primaryUrl = `${OVERPASS_PRIMARY_URL}/api/augmented_diff_status`;
  const secondaryUrl = `${OVERPASS_SECONDARY_URL}/api/augmented_diff_status`;

  const getStatus = async (url) => parseInt(await request(url).then(res => res.text()), 10);

  try {
    const primaryLatest = await getStatus(primaryUrl);
    if(max > primaryLatest) throw new Error('Required state is not in Primary overpass yet');
    return primaryLatest;
  } catch (e) {
    console.log(`Primary overpass (${primaryUrl}) failed: ${e}`);
    console.log(`Trying secondary ${secondaryUrl}...`);
    try {
      const secondaryLatest = await getStatus(secondaryUrl);
      if(max > secondaryLatest) {
        throw new Error('Required state is not in Secondary overpass yet');
      }
      return secondaryLatest;
    } catch (e) {
      throw e;
    }
  }
};

const getDataParam = (createdAt, closedAt, closed = true) => {
  let adiffParam = '';
  // We need to substract 1 sec from changeset created at value to receive correct results from overpass
  // https://github.com/osmlab/changeset-map/blob/master/lib/query.js#L23
  createdAt = moment(createdAt).add(-1, 'seconds').utc().format();

  if(closed) {
    adiffParam = `[adiff:%22${createdAt},%22,%22${closedAt}%22];`;
  } else {
    adiffParam = `[adiff:%22${createdAt},%22];`;
  }

  return (
    '[out:xml]' +
    adiffParam +
    '(node(bbox)(changed);way(bbox)(changed);relation(bbox)(changed););out%20meta%20geom(bbox);'
  );
}

const getBboxParam = (bbox) => {
  return [bbox.left, bbox.bottom, bbox.right, bbox.top].join(',');
}

module.exports = {
  getChangesets,
  getChangesetMetadata,
  getTimestampsStates,
  queryOverpass,
  parseJsonData,
};

