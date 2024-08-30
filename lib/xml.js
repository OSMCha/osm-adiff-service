'use strict';

const _ = require('lodash');
const htmlparser = require('htmlparser2');
const osmAdiffParser = require('@osmcha/osm-adiff-parser');

/*
 * Parse osmChange XML format documented here: https://wiki.openstreetmap.org/wiki/OsmChange
 * (Contains new versions of each modified element)
 */
const parseOsmChangeXml = (xmlString) => {
  let buffer = {};
  let items = [];
  let tempType = '';
  const json = {};

  const opts = {
    onopentag: (name, attr) => {
      switch (name) {
        case 'osmChange':
          json[name] = [attr];
          break;
        case 'modify':
        case 'delete':
        case 'create':
          if(! json.osmChange[0][name]) {
            json.osmChange[0][name] = [];
          }

          break;
        case 'node':
        case 'way':
        case 'relation':
          buffer = {
            ...attr
          };

          tempType = name;

          if (name === 'way') {
            buffer.geometry = [];
          }
          if (name === 'relation') {
            buffer.member = [];
            buffer.node = [];
            buffer.geometry = [];
          }

          break;
        case 'tag':
          if(! buffer.tag) buffer.tag = [];
          buffer.tag.push({ k: attr.k, v: attr.v });
          break;
        case 'nd':
          if(! buffer.nd) buffer.nd = [];
          buffer.nd.push({ ref: attr.ref });
          buffer.geometry.push(null);
          break;
        case 'member':
          buffer.member.push(attr);
          break;
      }
    },
    onclosetag: (name) => {
      if (name === 'node' || name === 'way' || name === 'relation' || name === 'area') {
        if (buffer.geometry && buffer.geometry.every((g) => g === null)) {
          delete buffer.geometry;
        }
        if (name === 'relation') {
          delete buffer.node;
        }

        items.push(buffer);
      }

      if(name === 'modify' || name === 'delete' || name === 'create') {
        const obj = {};
        obj[tempType] = items;
        json.osmChange[0][name].push(obj);
        items = [];
        tempType = '';
      }
    },
  };

  const parser = new htmlparser.Parser(opts, { decodeEntities: true, xmlMode: true });
  parser.write(xmlString);
  parser.end();

  return json;
};


/*
 * Parse OSM Changeset Metadata XML, of the form returned by
 * https://www.openstreetmap.org/api/0.6/changeset/:id
 * (Contains changeset's bbox, timestamp, comment, and authorship)
 */
const parseChangesetXml = (xmlString) => {
  const result = {};

  const opts = {
    onopentag: (name, attr) => {
      switch (name) {
        case 'osm':
          if(! result[name]) result[name] = [];
          result[name].push(attr);
          break;
        case 'changeset':
          if(! result.osm[name]) result.osm[0][name] = [];
          result.osm[0][name].push(attr);
          break;
        case 'tag':
          if(! result.osm[0].changeset[0][name]) result.osm[0].changeset[0][name] = [];
          result.osm[0].changeset[0][name].push(attr);
          break;
      }
    },
  };

  const parser = new htmlparser.Parser(opts, {
    decodeEntities: true,
    xmlMode: true
  });
  parser.write(xmlString);
  parser.end();

  return result;
};

/*
 * Parse OSM Augmented Diff format, documented here:
 * https://wiki.openstreetmap.org/wiki/Overpass_API/Augmented_Diffs
 * (Contains both old and new versions of all modified elements)
 */
const parseAugmentedDiff = osmAdiffParser;

module.exports = { parseOsmChangeXml, parseChangesetXml, parseAugmentedDiff };
