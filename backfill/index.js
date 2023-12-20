#!/usr/bin/env node
'use strict';
const argv = process.argv.slice(2);
const helpers = require('./helpers');
const worker = require('./worker');
const getChangesetTimings = helpers.getChangesetTimings;
const getReplications = helpers.getReplications;
const getXML = helpers.getXML;
const handleChangesetUpload = worker.handleChangesetUpload;
const processChangeset = worker.processChangeset;
const parser = require('xml2json');

if (Number.isNaN(parseInt(argv && argv[1]))) {
    console.log('');
    console.log(
        'USAGE: node backfill <stack> <changeset_id> <padding>'
    );
    console.log('stack :<required> production | staging | ...');
    console.log('changeset_id: <required> Only accepts one changeset id');
    console.log('padding: <optional> The range of minutely replication files to look for the changeset id in. eg. [starting[0].osc.gz, starting[padding].osc.gz')
    process.exit(1);
}


const changesetId = parseInt(argv[1], 10);
console.log('changesetId=', changesetId);
getChangesetTimings(changesetId)
    .then(getReplications)
    .then(replications => {
        return Promise.all(replications.map(replication =>
            getXML(replication).then(xml => {
                return parser.toJson(xml, {
                    arrayNotation: true,
                    object: true
                });
            })));
    })
    .then(arrayParsed => processChangeset(arrayParsed, changesetId))
    .then(handleChangesetUpload)
    .then(r => console.log(r))
    .catch(e => console.error(e));
