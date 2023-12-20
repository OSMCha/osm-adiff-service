'use strict';
const moment = require('moment');


const getStates = (created_at, closed_at) => {
    const start = moment.utc(created_at);

    const states = [];
    const minute = start.startOf('minute');
    while (minute.isBefore(closed_at) || minute.isSame(closed_at)) {
        const nextMinute = minute.add(1, 'minute');
        // echo $(( $( date --date="2017-01-16T15:36:00Z" +%s )/60 - 22457216)), from http://wiki.openstreetmap.org/wiki/Overpass_API/Augmented_Diffs#Deriving_adiff_id_from_time_interval
        const state = (nextMinute.unix() / 60) - 22457216;
        states.push(state);
    }
    return states;
};

const getStateForMinute = (minute) => {
    minute = moment.utc(minute);
    const start = minute.startOf('minute');
    const end = start.add(1, 'minute');
    const state = (end.unix()/60) - 22457216;
    return state;
};

module.exports = {
    getStates,
    getStateForMinute,
};
