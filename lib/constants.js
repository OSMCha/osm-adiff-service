'use strict';

const S3_MAX_RETRIES = 20;

const S3_CONNECT_TIMEOUT = 3000;

const TYPES = ['node', 'way', 'relation'];

const CHANGE_STATES = ['create', 'modify', 'delete'];

const OSM_CHANGESET_API = 'https://www.openstreetmap.org/api/0.6/changeset';

const OSMCHA_URL = process.env.OsmchaUrl || 'https://osmcha.org/api/v1';

module.exports = {
  S3_MAX_RETRIES,
  S3_CONNECT_TIMEOUT,
  TYPES,
  CHANGE_STATES,
  OSM_CHANGESET_API,
  OSMCHA_URL
}
