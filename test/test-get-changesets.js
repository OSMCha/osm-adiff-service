const test = require('tape');
const fs = require('fs');
const { getChangesets } = require('../lib/get-changesets');
const join = require('path').join;

test('test get changeset processes changeset', async (assert) => {
    const filePath = join(__dirname, 'fixtures', 'aug-diff-test.osm');
    const data = fs.readFileSync(filePath);
    const results = await getChangesets(data);
    const changesets = [
        '85063040',
        '85063048',
        '85063053',
        '85063078',
        '85063085',
        '85063108',
        '85063113',
        '85063116'
    ];
    assert.deepEqual(Object.keys(results), changesets);
    assert.end();
});
