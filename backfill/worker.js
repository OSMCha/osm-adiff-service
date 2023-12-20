'use strict';

const join = require('path').join;
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const _ = require('lodash');
var queue = require('d3-queue').queue;

const adiff_stuff = require('../lib/get-changesets');
const getChangesetMetadata = adiff_stuff.getChangesetMetadata;
const getAllStates = adiff_stuff.getAllStates;
const fetchStates = adiff_stuff.fetchStates;
const parser = require('xml2json');

module.exports = {
    handleChangesetUpload,
    processChangeset
};

function processChangeset(parsedObj, changesetId) {

    // get all timestamps and changeset IDs
    let timestamps = [];
    let changesetIds = [];
    const featureMap = {};
    const changeStates = ['create', 'modify', 'delete'];
    const types = ['node', 'way', 'relation'];
    return new Promise(res => {
        parsedObj.forEach(jsonData => {
            if (!jsonData.osmChange || !jsonData.osmChange[0]) {
                throw new Error('OSM data missing from XML file');
            }
            changeStates.forEach(s => {
                if (jsonData.osmChange[0][s]) {
                    jsonData.osmChange[0][s].forEach(f => {
                        types.forEach(t => {
                            if (f[t]) {
                                f[t].forEach(o => {
                                    if (
                                        o.changeset !== changesetId.toString()
                                    ) {
                                        return;
                                    }
                                    timestamps.push(o.timestamp);
                                    changesetIds.push(o.changeset);
                                    if (!featureMap[o.changeset]) {
                                        featureMap[o.changeset] = [];
                                    }
                                    featureMap[o.changeset].push(o.id);
                                });
                            }
                        });
                    });
                }
            });
        });

        timestamps = _.uniq(timestamps);
        changesetIds = _.uniq(changesetIds);
        console.log('# timestamps found ', timestamps.length);
        console.log('# changesets found', changesetIds.length);
        // for each timestamp get states
        const states = getAllStates(timestamps);
        // for each state:
        console.log('# states', states);
        fetchStates(states, changesetIds, (err, allChangesets) => {
            if (err) {
                console.log('Error:', err);
                throw err;
            }
            console.log(Object.keys(allChangesets));
            const q = queue(10);
            Object.keys(allChangesets).forEach(changeset => {
                q.defer(getChangesetMetadata, changeset, allChangesets);
            });
            q.awaitAll((err, data) => {
                // console.log(data);
                if (err) {
                    console.log('Error:', err);
                    throw err;
                }

                // generate featureMap
                const realFeatureMap = {};
                Object.keys(allChangesets).forEach(id => {
                    allChangesets[id].elements.forEach(f => {
                        if (!realFeatureMap[id]) {
                            realFeatureMap[id] = [];
                        }
                        realFeatureMap[id].push(f.id);
                    });
                });

                // do the diff between featureMap and realFeatureMap
                const diffFeatureMap = {};
                changesetIds.forEach(cid => {
                    if (featureMap[cid] && realFeatureMap[cid]) {
                        diffFeatureMap[cid] = _.difference(
                            featureMap[cid],
                            realFeatureMap[cid]
                        );
                        if (diffFeatureMap[cid].length) {
                            allChangesets[cid].metadata.incomplete = true;
                            console.log('# incomplete changeset', cid);
                        }
                    }
                });
                console.log('# feature diff', JSON.stringify(diffFeatureMap));
                res(allChangesets);
            });
        });
    });
}

function handleChangesetUpload(changesetObject) {
    if (Object.keys(changesetObject).length === 1) {
        console.log(
            'Johny boy is uploading,',
            Object.keys(changesetObject)[0],
            'to s3'
        );
        const changesetId = Object.keys(changesetObject)[0];
        var changeset = changesetObject[changesetId];
        return uploadToS3(changeset);
    } else if (Object.keys(changesetObject).length === 0) {
        return null;
    } else {
        console.log(Object.keys(changesetObject));
        throw new Error('multiple or no changesets please check config/env');
    }
}

function checkOnS3(changeset) {
    const outputBucket = process.env.OutputBucket;
    const outputPrefix = process.env.OutputPrefix;
    const changesetId = changeset.metadata.id;
    const key = join(outputPrefix, changesetId + '.json');
    const params = {
        Bucket: outputBucket,
        Key: key
    };
    return new Promise((res, rej) => {
        s3.getObject(params, (err, data) => {
            if (err && err.code === 'NoSuchKey') {
                return res();
            } else if (err) {
                return rej(err);
            } else {
                const tempChangeset = JSON.parse(data.Body);
                if (tempChangeset) {
                    let elements = changeset.elements.concat(
                        tempChangeset.elements
                    );
                    elements = _.uniqWith(
                        elements,
                        (eltA, eltB) =>
                            eltA.type + eltA.id === eltB.type + eltB.id
                    );
                    changeset.elements = elements;
                    return res(changeset);
                } else {
                    return rej(new Error('Failed to read changeset from S3'));
                }
            }
        });
    });
}

function uploadToS3(changeset) {
    const params = {
        ACL: 'public-read',
        ContentType: 'text/plain',
        Bucket: process.env.OutputBucket,
        Key: process.env.OutputPrefix + '/' + changeset.metadata.id + '.json',
        Body: JSON.stringify(changeset)
    };
    return checkOnS3(changeset).then(data => {
        if (data) {
            console.log('Updating ' + changeset.metadata.id);
            params.Body = JSON.stringify(changeset);
        }
        return new Promise((res, rej) => {
            s3.upload(params, err => {
                if (err) {
                    console.log('Error: ', err);
                    return rej(err);
                } else {
                    console.log('written ' + params.Key + ' to s3');
                    return res();
                }
            });
        });
    });
}
