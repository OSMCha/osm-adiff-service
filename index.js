#!/usr/bin/env node
'use strict';
global.Promise = require('bluebird');
const zlib = require('zlib');
const util = require('util');
const gunzip = util.promisify(zlib.gunzip);

const { getChangesets } = require('./lib/get-changesets');
const { uploadToS3 } = require('./lib/s3');
const { postTagChanges } = require('./lib/tagChanges');
const { formatReplicationKey } = require('./util/format-replication-key');
const { request } = require('./util/request');
const { s3 } = require('./lib/s3-client');
const { REPLICATION_BUCKET } = require('./lib/constants');

process.on('unhandledRejection', (up) => { throw up; });
process.on('exit', (code) => {
    console.log(`Exit with code: ${code}`);
});

const run = async (replicationFileId) => {
  console.time('TIME');
  const { Body } = await s3.getObject({
    Bucket: REPLICATION_BUCKET,
    Key: formatReplicationKey(replicationFileId)
  }).promise();
  const xmlBin = await gunzip(Body);

  const changesets = await getChangesets(xmlBin.toString());
  const changesetList = Object.values(changesets);

  await Promise.all(changesetList.map(uploadToS3));
  console.log('Uploaded all changesets to s3');

  await Promise.all(changesetList.map(postTagChanges));
  console.log('Posted all changesets tagChanges to OSMCha API');
  console.timeEnd('TIME');
};

module.exports = run;