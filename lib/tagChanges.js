'use strict';

const { createTagDiff } = require('changetags');
const { OSMCHA_URL } = require('./constants');
const { request } = require('../util/request');

const postTagChanges = async (changeset) => {
  try {
    const changesetId = changeset.metadata.id;
    const url = `${OSMCHA_URL}/changesets/${changesetId}/tag-changes/`;
    const tagDiff = createTagDiff(changeset);
    if (tagDiff) {
      await request(url, 'POST', JSON.stringify(tagDiff), `Token ${process.env.OsmchaAdminToken}`);
      console.log(`Posted ${changesetId} tag changes to OSMCHA API`);
    }
  } catch (e) {
    console.log(`Error in the OSMCHA API: ${e}`);
  }
};

module.exports = { postTagChanges };
