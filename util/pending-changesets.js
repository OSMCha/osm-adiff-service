'use strict';
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const moment = require('moment');
const argv = require('minimist')(process.argv.slice(2));
const stack = argv.stack
const prefix = `real-changesets/${stack}/pending/too_long`;
const queue = require('d3-queue').queue;

function getPending(marker, callback) {
    const allKeys = [];
    s3.listObjects({Bucket: 'mapbox', Prefix: prefix, Marker: marker}, function(err, data){
        if (err) {
            console.log(err);
            process.exit(0);
        }
        allKeys.push(data.Contents);
        if (data.IsTruncated) {
          getPending(data.NextMarker, callback);
      } else {
        callback(null, allKeys);
    }
});

}

const pendingChangesets = [];
function prepareCSV(data) {
    pendingChangesets.forEach(function(f) {
        const created_at = moment.utc(f.metadata['created_at']);
        const closed_at = moment.utc(f.metadata['closed_at']);
        const diff = closed_at.diff(created_at);
        const editor = f.metadata.tag.filter(function(t) {
            if (t['k'] === 'created_by') {
                return true;
            }
        });
        if (!editor.length) {
            editor[0] = {};
            editor[0]['v'] = 'no editor specified';
        }
        console.log(f.metadata.id+ ',', Math.ceil(moment.duration(diff).asMinutes()) + ' minutes,', f.metadata.num_changes + ' edits,', f.metadata.user + ',', editor[0]['v'] + ',', `https://openstreetmap.org/changeset/${f.metadata.id}` );
    });
}

getPending('*', function (err, data) {
    const q = queue(20);
    data[0].forEach(function(object) {
        const params = {
            Bucket: 'mapbox',
            Key: object.Key
        };
        q.defer(fetchJSON, params);
    })
    q.awaitAll(function(err, data) {
        prepareCSV(data);
    });
});

function fetchJSON(params, callback) {
    s3.getObject(params, function(err, data) {
        if (data) {
            pendingChangesets.push(JSON.parse(data.Body));
        }
        callback();
    });
}
