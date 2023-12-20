# osm-adiff-watchbot

Listens to augmented diff files published to S3 by Overpass and minutely replication files from `osm-metronome`, and merges them together to create full representations of changesets. 

# Real OpenStreetMap Changesets

When a changeset is pushed to OSM, this stack builds a representation of the exact change that happened:

* Changeset metadata - username, id, timestamp, comment etc.
* Elements - each feature that was added, modified, or deleted in the changeset.
* For each element, the current and previous version including geometry and metadata.

#### Details

* New changesets are pushed to `https://s3.amazonaws.com/mapbox/real-changesets/production/<changeset-id>.json`
* Augmented Diffs are pushed by Ovepass are pushed to `https://s3-ap-northeast-1.amazonaws.com/overpass-db-ap-northeast-1/augmented-diffs/<state-id.osc>`. 
* The latest state id is published here `https://s3-ap-northeast-1.amazonaws.com/overpass-db-ap-northeast-1/augmented-diffs/latest`

#### Example

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

## What is this, and why?

A lot of processes around inspecting and searching for potentially bad edits on OpenStreetMap depend on being able to view a "changeset" in its entirety. This helps in gauging the context of an edit, see similar edits by the same user, and see edits in their "finished" state (i.e. not in between a changeset).

Our primary tool for visualizing changesets has been [changeset-map](http://osmlab.github.io/changeset-map/). We depend on [augmented diffs](http://wiki.openstreetmap.org/wiki/Overpass_API/Augmented_Diffs) generated by Overpass to generate these changeset representations and visualizations.

Augmented Diffs contains complete representations of changes in OSM for every minute. One can also query for a custom time range, and filter by bounding box or other attributes. These queries can be extremely slow, especially for large changesets, and were a major bottleneck in scaling up changeset reviewing processes.

### How to fill a missing changeset

To backfill a particular changeset
- Make sure you have authorized via `mbx auth <mfa_code>`.
- Run `node backfill <stack_name> <changeset_id> <?padding>`
- It might take a while for the command to run.

__Params__

`stack` :<required> production | staging | etc

`changeset_id`: <required> Only accepts one changeset id

`padding`: <optional> The range of minutely replication files to look for the changeset id in. eg. `[239.osc.gz, (239+padding).osc.gz]`


### This sounds like quite a lot of duct-tape

It is. For now, this is going to improve our workflows, but while this in place we can continue working on Dynamosm.
