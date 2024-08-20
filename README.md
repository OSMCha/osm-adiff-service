# osm-adiff-service

This service reads the minutely replication files published by OpenStreetMap, and builds JSON documents which describe each changeset in detail (including information which is not included in the replication file). It publishes these JSON files to S3, and also POSTs a summary of tag changes to the OSMCha API.

Each changeset JSON contains complete information about the changeset:

* Changeset metadata - username, id, timestamp, comment etc.
* Elements - each feature that was added, modified, or deleted in the changeset.
* For each element, the current and previous version including geometry and metadata.

## What is this, and why?

OSMCha's purpose is to let users view a changeset in its entirety, including metadata about the changeset and the "before" and "after" versions of every OSM element that was changed.

The OSM API publishes minutely [replication files](https://wiki.openstreetmap.org/wiki/Planet.osm/diffs) in [`.osc` format](https://wiki.openstreetmap.org/wiki/OsmChange) that contain some information about each edit that is made to OSM, but these files are optimized for small size and don't contain all of the details required by OSMCha. Specifically:

- they do not include old ("before") versions of elements that changed
- they don't include way geometries at all unless the geometry itself was edited (not just the tags)
- they don't include bounding boxes

A richer diff format called [augmented diff](https://wiki.openstreetmap.org/wiki/Overpass_API/Augmented_Diffs) addresses these limitations. [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) is capable of producing this type of diff. The `osm-adiff-service` can be used to process a replication file from the OSM API, retrieve additional data about each change by getting an augmented diff from Overpass, and republish the resulting info as JSON. These JSON artifacts are then served by the [OSMCha backend](https://github.com/OSMCha/osmcha-django) and rendered in the browser using [changeset-map](https://github.com/osmlab/changeset-map).

#### Example JSON changeset output

```json
// 20170309131154
// https://s3.amazonaws.com/mapbox/real-changesets/46700150.json

{
  "metadata": {
    "id": "46700150",
    "created_at": "2017-03-09T06:20:05Z",
    "closed_at": "2017-03-09T06:20:06Z",
    "open": "false",
    "num_changes": "1",
    "user": "johnparis",
    "uid": "2126146",
    "min_lat": "33.5335375",
    "max_lat": "33.5335375",
    "min_lon": "-7.6846717",
    "max_lon": "-7.6846717",
    "comments_count": "0",
    "tag": [
      {
        "k": "comment",
        "v": "Fix with Osmose"
      },
      {
        "k": "locale",
        "v": "en-US"
      },
      {
        "k": "host",
        "v": "http://www.openstreetmap.org/id"
      },
      {
        "k": "imagery_used",
        "v": "Bing aerial imagery"
      },
      {
        "k": "created_by",
        "v": "iD 2.1.3"
      }
    ]
  },
  "elements": [
    {
      "id": "4719430892",
      "lat": "33.5335375",
      "lon": "-7.6846717",
      "version": "2",
      "timestamp": "2017-03-09T06:20:06Z",
      "changeset": "46700150",
      "uid": "2126146",
      "user": "johnparis",
      "old": {
        "id": "4719430892",
        "lat": "33.5335375",
        "lon": "-7.6846717",
        "version": "1",
        "timestamp": "2017-03-05T23:46:50Z",
        "changeset": "46609213",
        "uid": "5435265",
        "user": "zakaria f",
        "action": "modify",
        "type": "node",
        "tags": {
          "name": "لساسفة",
          "highway": "bus_stop",
          "name:ar": "لساسفة",
          "name:en": "Lisassfa",
          "name:fr": "Lissasfa"
        }
      },
      "action": "modify",
      "type": "node",
      "tags": {
        "highway": "bus_stop",
        "name": "Lissasfa لساسفة",
        "name:ar": "لساسفة",
        "name:en": "Lisassfa",
        "name:fr": "Lissasfa"
      }
    }
  ]
}
```

### How to run

#### JS library

```
  const run  = require('./index');

  // To process this file https://planet.openstreetmap.org/replication/minute/006/012/443.osc.gz,
  // the value should be 6012443
  const minuteReplication = 6012443;

  run(minuteReplication);
```

#### CLI

To process a single replication file, pass the minute replication id to the cli:

```
  yarn process 6012443
```

If you want to connect it to a Redis queue in order to have a service that process new replication files continuously, start a Redis service, configure the url in the `RedisServer` environment variable and use the update-queue command.

```
  yarn update-queue
```

### How to fill a missing changeset

To backfill a particular changeset
- Make sure you have authorized via `mbx auth <mfa_code>`.
- Run `node backfill <stack_name> <changeset_id> <?padding>`
- It might take a while for the command to run.

__Params__

`stack` :<required> production | staging | etc

`changeset_id`: <required> Only accepts one changeset id

`padding`: <optional> The range of minutely replication files to look for the changeset id in. eg. `[239.osc.gz, (239+padding).osc.gz]`

## Configuration

This library requires setting some environment variables, and the AWS credentials to upload the files to S3.

Environment Variable | Default value | Purpose
---|---|---
ReplicationBucket |  osm-planet-us-west-2 | S3 Bucket where the minute replication files are published.
OsmchaAdminToken |  null | OSMCha admin user token. It will enable posting the changeset Tag Changes to OSMCha.
OutputBucket | real-changesets | S3 Bucket that will store the real-changesets files.
OverpassPrimaryUrl | https://overpass.osmcha.org | Main overpass server.
OverpassSecondaryUrl | https://overpass-api.de | Fallback overpass server.
RedisServer | null | Redis service URL, in the format `redis[s]://[[username][:password]@][host][:port][/db-number]`
NumberOfWorkers | 5 | Number of concurrent replication files to be processed
