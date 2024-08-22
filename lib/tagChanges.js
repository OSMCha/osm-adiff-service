'use strict';

const { createTagDiff } = require('changetags');
const { OSMCHA_URL } = require('./constants');
const { request } = require('../util/request');

const postTagChanges = async (changeset) => {
  if (!process.env.OsmchaAdminToken) {
    console.log('OSMCha API Token is not configured.')
  }

  try {
    const changesetId = changeset.metadata.id;
    const url = `${OSMCHA_URL}/changesets/${changesetId}/tag-changes/`;
    const tagDiff = createTagDiff(changeset);
    if (tagDiff) {
      const body = Buffer.from(JSON.stringify(tagDiff), "utf8");
      const headers = {
        'Authorization': `Token ${process.env.OsmchaAdminToken}`,
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      };

      await request(url, { method: 'POST', headers, body });
      console.log(`Posted ${changesetId} tag changes to OSMCHA API`);
    }
  } catch (e) {
    console.log(`Error in the OSMCHA API: ${e}`);
  }
};

module.exports = { postTagChanges };
