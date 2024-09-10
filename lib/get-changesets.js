'use strict';
const _ = require('lodash');
const moment = require('moment');

const parseOsmChangeXml = require("@osmcha/osmchange-parser");
const parseChangesetXml = require("@osmcha/osm-changeset-xml-parser");
const parseAugmentedDiff = require("@osmcha/osm-adiff-parser");

const { getStateForMinute } = require('../util/get-states');
const { request } = require('../util/request');
const {
  OSM_CHANGESET_API,
  CHANGE_STATES,
  OVERPASS_PRIMARY_URL,
  OVERPASS_SECONDARY_URL
} = require('./constants');

const getChangesets = async (xml) => {
  const jsonData = await parseOsmChangeXml(xml);

  if (!jsonData) {
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
          !meta.open
        ),
        getBboxParam(meta.bbox)
      );

    const parsed = await parseAugmentedDiff(augmentedDiffXml);

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
      diffFeatureMap[cid] = _.difference(featureMap[cid], realFeatureMap[cid].map(s => +s));
      if (diffFeatureMap[cid].length) {
        results[cid].metadata.incomplete = true;
        console.log('# Incomplete changeset', cid);
      }
    }
  });

  console.log('# Feature diff', JSON.stringify(diffFeatureMap));

  for (let realChangeset of Object.values(results)) {
    makeBackwardsCompatible(realChangeset);
  }

  return results;
};

const parseJsonData = (osmChange) => {
  const featureMap = {};
  let timestamps = [];
  let changesetIds = [];

  for (let changeState of CHANGE_STATES) {
    if (osmChange[changeState]) {
      for (let element of osmChange[changeState]) {
        let { timestamp, changeset, id } = element;
        timestamps.push(timestamp);
        changesetIds.push(changeset);

        if (!featureMap[changeset]) {
          featureMap[changeset] = [];
        }
        featureMap[changeset].push(id);
      }
    }
  }

  timestamps = _.uniq(timestamps);
  changesetIds = _.uniq(changesetIds);

  return { timestamps, changesetIds, featureMap };
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
    const changesetData = await parseChangesetXml(body);

    const meta = changesetData.changeset;

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

/*
 * Convert some field types and object structures from the format returned by
 * osm-changeset-xml-parser to the format expected by current consumers of the
 * real-changesets dataset.
 */
const makeBackwardsCompatible = (realChangeset) => {
  // these fields need to be converted from Numbers (or Booleans) to strings
  let fields = [
    "metadata.min_lon",
    "metadata.min_lat",
    "metadata.max_lon",
    "metadata.max_lat",
    "metadata.bbox.left",
    "metadata.bbox.bottom",
    "metadata.bbox.right",
    "metadata.bbox.top",
    "metadata.id",
    "metadata.uid",
    "metadata.changes_count",
    "metadata.comments_count",
    "metadata.open",
  ];

  for (let field of fields) {
    let value = _.get(realChangeset, field);
    if (value !== undefined) {
      _.set(realChangeset, field, JSON.stringify(value));
    }
  }

  // tags need to be converted from { foo: "bar" } to [{ k: "foo", v: "bar" }] form
  realChangeset.metadata.tag = Object.entries(realChangeset.metadata.tags).map(([k, v]) => ({ k, v }));
  delete realChangeset.metadata.tags;
}

module.exports = {
  getChangesets,
  getChangesetMetadata,
  getTimestampsStates,
  queryOverpass,
  parseJsonData,
};

