'use strict';

const _  = require('lodash');
const { s3 } = require('./s3-client');

const checkOnS3 = async (changeset) => {
  const { OutputBucket, OutputPrefix  } = process.env;
  const changesetId = changeset.metadata.id;

  const params = {
    Bucket: OutputBucket,
    Key: `${OutputPrefix}/${changesetId}.json`
  };

  try {
    const data = await s3.getObject(params).promise();
    const tempChangeset = JSON.parse(data.Body);

    let elements = changeset.elements.concat(tempChangeset.elements);
    elements = _.uniqWith(elements, function (eltA, eltB) {
      return (eltA.type + eltA.id) === (eltB.type + eltB.id);
    });
    changeset.elements = elements;

    return changeset;

  } catch (e) {
    throw new Error(`Failed to read changeset from S3 (${OutputBucket}/${OutputPrefix}/${changesetId}.json): ${e}`);
  }
};

const uploadToS3 = async (changeset) => {
  const { OutputBucket, OutputPrefix } = process.env;

  const params = {
    ACL: 'public-read',
    ContentType: 'text/plain',
    Bucket: OutputBucket,
    Key: `${OutputPrefix}/${changeset.metadata.id}.json`,
    Body: JSON.stringify(changeset)
  };

  try {
    const data = await checkOnS3(changeset);

    if (data) {
      console.log('Updating ' + changeset.metadata.id);
      params.Body = JSON.stringify(changeset);
    }
  } catch (e) {
    console.log('ERR: ', e);
  }

  try {
    await s3.upload(params).promise();
    console.log('Written ' + params.Key + ' to s3');
  } catch (e) {
    console.log('S3 upload error: ', e);
    return process.exit(1);
  }
};


module.exports = { checkOnS3, uploadToS3 };
