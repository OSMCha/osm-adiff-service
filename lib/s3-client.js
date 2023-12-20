'use strict';

const AWS = require('aws-sdk');

const { S3_MAX_RETRIES, S3_CONNECT_TIMEOUT } = require('./constants');

const s3 = new AWS.S3({ maxRetries: S3_MAX_RETRIES, httpOptions: { connectTimeout: S3_CONNECT_TIMEOUT } });


module.exports = {
  s3,
};
