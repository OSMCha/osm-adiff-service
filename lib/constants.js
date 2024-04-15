'use strict';

const S3_MAX_RETRIES = 20;

const S3_CONNECT_TIMEOUT = 3000;

const TYPES = ['node', 'way', 'relation'];

const CHANGE_STATES = ['create', 'modify', 'delete'];

const OSM_CHANGESET_API = 'https://www.openstreetmap.org/api/0.6/changeset';

const OSMCHA_URL = process.env.OsmchaUrl || 'https://osmcha.org/api/v1';

const OVERPASS_PRIMARY_URL = process.env.OverpassPrimaryUrl || 'https://overpass.osmcha.org';
const OVERPASS_SECONDARY_URL = process.env.OverpassSecondaryUrl || 'https://overpass-api.de';
const REDIS_SERVER = process.env.RedisServer;
const REPLICATION_BUCKET = process.env.ReplicationBucket || 'osm-planet-us-west-2';
const OVERPASS_DELAY = process.env.OverpassServerDelay || 5;

module.exports = {
  S3_MAX_RETRIES,
  S3_CONNECT_TIMEOUT,
  TYPES,
  CHANGE_STATES,
  OSM_CHANGESET_API,
  OSMCHA_URL,
  OVERPASS_PRIMARY_URL,
  OVERPASS_SECONDARY_URL,
  REDIS_SERVER,
  REPLICATION_BUCKET
}
