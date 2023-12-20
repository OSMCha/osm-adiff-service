#!/usr/bin/env node
'use strict';
global.Promise = require('bluebird');
const zlib = require('zlib');
const util = require('util');
const gunzip = util.promisify(zlib.gunzip);

const { getChangesets } = require('./lib/get-changesets');
const { uploadToS3 } = require('./lib/s3');
const { postTagChanges } = require('./lib/tagChanges');
const { s3 } = require('./lib/s3-client');

process.on('unhandledRejection', (up) => { throw up; });
process.on('exit', (code) => {
    console.log(`Exit with code: ${code}`);
});

const snsSubject = process.env.Subject;
const snsMessage = JSON.parse(process.env.Message);
const AMAZON_S3_NOTIFICATION = 'Amazon S3 Notification';

if (snsSubject === AMAZON_S3_NOTIFICATION) {
    (async () => {
        console.time('TIME');
        const key = snsMessage.Records[0].s3.object.key;
        const bucket = snsMessage.Records[0].s3.bucket.name;

        console.log(`# Fetching s3://${bucket}/${key} ...`);
        const { Body } = await s3.getObject({ Bucket: bucket, Key: key }).promise();
        console.log(`Finished fetching ${key} file ...`);

        const xml = await gunzip(Body);
        console.log('Decompressing...');

        const changesets = await getChangesets(xml);
        const changesetList = Object.values(changesets);

        await Promise.all(changesetList.map(uploadToS3));
        console.log('Uploaded all changesets to s3');

        await Promise.all(changesetList.map(postTagChanges));
        console.log('Posted all changesets tagChanges to OSMCha API');
        console.timeEnd('TIME');
    })();
};
