'use strict';
var fetch = require('node-fetch');
const pako = require('pako');
const R = require('ramda');
const moment = require('moment');
var exec = require('child_process').exec;
const parser = require('xml2json');
const argv = process.argv.slice(2);
let replicationPadding = 5;

if (argv[2] && !Number.isNaN(parseInt(argv[2], 10)))  {
    replicationPadding = parseInt(argv[2], 10);
}

console.log('padding=', replicationPadding);

function getStackInfo(stack) {
    return new Promise((res, rej) => {
        console.log('getting stack info...');
        exec('source "$(npm root -g)/mbxcli/mapbox.sh"; mbx info ' + stack, function(err, stackInfo) {
            if (err) {
                console.log('mbx login error');
                return rej(err);
            }
            console.log('got stack info :)');
            res(JSON.parse(stackInfo));
        });
    });
}

function getChangesetTimings(changeset) {
    const changesetUrl = `https://www.openstreetmap.org/api/0.6/changeset/${changeset}`;
    return fetch(changesetUrl).then(body => body.text()).then(text => {
        const changesetData = parser.toJson(text, {
            arrayNotation: true,
            object: true
        });
        if (!changesetData || !changesetData.osm[0] || !changesetData.osm[0].changeset[0]) {
            throw new Error('not found/ please check changeset');
        }
        return changesetData.osm[0].changeset[0];
    });
}

function getReplicationId(timeString) {
    const time = moment(timeString).utc();
    const maz = `https://osm.mazdermind.de/replicate-sequences/?Y=${time.year()}&m=${time.month() + 1}&d=${time.date()}&H=${time.hour()}&i=${time.minute()}&s=${time.second()}&stream=minute#`;
    return fetch(maz).then(body => body.text()).then(text => {
        if (!text || !text.split('\n')[4]) throw new Error(`${maz} is incorrect`);
        var testArray = text.split('\n');
        let data;
        for (var i = 0; i< testArray.length; i++) {
            if (testArray[i].indexOf('sequenceNumber') > -1) {
                console.log(testArray[i]);
                data = testArray[i].split('=')[1];
            }
        }
        data = parseInt(data, 10);

        if (Number.isNaN(data)) {
            throw new Error(`${maz} is incorrect`);
        }
        return data;
    });
}

function getReplications(metadata) {
    const created_at = metadata.created_at;
    const closed_at = metadata.closed_at;
    console.log('changeset created at', metadata.created_at);
    console.log('changeset closed at', metadata.closed_at);
    
    const queue = [getReplicationId(created_at), getReplicationId(closed_at)];
    return Promise.all(queue).then(replications => {
        const paddedReplication = R.range(
            replications[0] - replicationPadding,
            replications[1] + replicationPadding + 1
        );
        console.log('replication ids', replications, `padding=${replicationPadding}`, paddedReplication);
        return paddedReplication;
    });
}

function getXML(replicationId) {
    if (typeof replicationId !== 'number') {
        throw new Error('replicationId should be a number');
    }
    let n = replicationId.toString();
    if (n.length < 9) {
        const pad = Array(9 - n.length + 1).join('0');
        n = pad + n;
    }
    const url = `https://s3.amazonaws.com/osm-changesets/minute/${n.slice(0, 3)}/${n.slice(3, 6)}/${n.slice(6, 9)}.osc.gz`;
    return fetch(url).then(d => d.buffer()).then(d => pako.inflate(d, { to: 'string' }));
}

module.exports = {
    getReplications,
    getReplicationId,
    getStackInfo,
    getChangesetTimings,
    getXML
};
