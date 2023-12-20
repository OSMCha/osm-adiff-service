'use strict';

const _ = require('lodash');
const htmlparser = require('htmlparser2');


const parseXml = (xmlString) => {
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


const parseChangesetXml = (xml) => {
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
  parser.write(xml);
  parser.end();

  return result;
};

const parseAugmentedDiff = (xml, changesetsFilter) => {
  let currentMember = {};
  let currentMode = '';
  let currentAction = '';
  let currentElement = {};
  let oldElement = {};
  const changesetMap = {};

  const isElement = (symbol) => {
    return (symbol === 'node' || symbol === 'way' || symbol === 'relation');
  };

  const opts = {
    onopentag: (name, attr) => {
      if (name === 'action') {
        currentAction = attr.type;
      }
      if (name === 'new' || name === 'old') {
        currentMode = name;
      }
      if (isElement(name)) {
        if (currentMode === 'new' && (currentAction === 'modify' ||
          currentAction === 'delete')) {
          oldElement = _.cloneDeep(currentElement);
          currentElement = attr;
          currentElement.old = oldElement;
        } else {
          currentElement = attr;
        }
        currentElement.action = currentAction;
        currentElement.type = name;
        currentElement.tags = {};
        if (name === 'way') {currentElement.nodes = []; }
        if (name === 'relation') {currentElement.members = []; currentMember = {};}
      }
      if (name === 'tag' && currentElement) {
        currentElement.tags[attr.k] = attr.v;
      }

      if (name === 'nd' && currentElement && currentElement.type === 'way') {
        currentElement.nodes.push(attr);
      }

      if (name === 'nd' && currentElement && currentElement.type === 'relation') {
        currentMember.nodes.push(attr);
      }

      if (name === 'member' && currentElement && currentElement.type === 'relation') {
        currentMember = _.cloneDeep(attr);
        currentMember.nodes = [];
        currentElement.members.push(currentMember);
      }
    },
    onclosetag: (name) => {
      if (name === 'action') {
        const changeset = currentElement.changeset;
        if (changesetsFilter && changesetsFilter.length) {
          if (changesetsFilter.indexOf(changeset) !== -1) {
            if (changesetMap[changeset]) {
              changesetMap[changeset].push(currentElement);
            } else {
              changesetMap[changeset] = [currentElement];
            }
          }
        } else {
          if (changesetMap[changeset]) {
            changesetMap[changeset].push(currentElement);
          } else {
            changesetMap[changeset] = [currentElement];
          }
        }
      }
    }
  };

  const parser = new htmlparser.Parser(opts, {
    decodeEntities: true,
    xmlMode: true
  });
  parser.write(xml);
  parser.end();

  return changesetMap;
};

module.exports = { parseXml, parseChangesetXml, parseAugmentedDiff };
