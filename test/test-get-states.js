const test = require('tape');
const { parseSequenceNumber, getOverpassDelay, getOverpassTimestamp } = require('../util/get-states');

test('test getOverpassTimestamp', async (assert) => {
  const timestamp = await getOverpassTimestamp();
  const date = new Date(timestamp);
  assert.equal(typeof date, 'object');
  assert.end();
});

test('test getOverpassDelay', async (assert) => {
  const delay = await getOverpassDelay();
  assert.equal(typeof delay, 'number');
  assert.ok(delay > 0);
  assert.end();
});

test('test parseSequenceNumber', async (assert) => {
  const text = `
#Mon Apr 15 12:31:39 UTC 2024
sequenceNumber=6048654
timestamp=2024-04-15T12\\:31\\:15Z`;
  assert.equal(parseSequenceNumber(text), 6048654);
  assert.end();
});