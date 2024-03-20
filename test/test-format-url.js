const test = require('tape');

const { formatReplicationKey } = require('../util/format-replication-key');

test('test replication url formatting', function(assert) {
    assert.equal(formatReplicationKey(1234), 'planet/replication/minute/000/001/234.osc.gz')
    assert.equal(formatReplicationKey(502349), 'planet/replication/minute/000/502/349.osc.gz')
    assert.equal(formatReplicationKey('001253034'), 'planet/replication/minute/001/253/034.osc.gz')
    assert.end();
});