const test = require('tape');
const getChangesets = require('../lib/get-changesets');
const join = require('path').join;

test('test get changeset processes changeset', function(assert) {
    const filePath = join(__dirname, 'fixtures', '363.osm');
    console.log(filePath);
    process.env.OutputBucket = 'overpass-db-ap-northeast';
    process.env.OutputPrefix = 'augmented-diffs';
    process.env.AdiffBaseUrl = 'https://s3-ap-northeast-1.amazonaws.com/overpass-db-ap-northeast-1/augmented-diffs/';
    getChangesets(filePath, function(err, changesets) {
        if (err) {
            console.log('error', err);
        }
        console.log('changesets', changesets);
        assert.end();
    });
});
