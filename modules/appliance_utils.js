"use strict";

export function calculateApplianceCost(appliance, avg_cost) {
    let cost = avg_cost * (appliance.power / 1000) * (appliance.hours + (appliance.minutes / 60));
    cost = Math.round(cost * 10 + Number.EPSILON) / 10;
    return cost;
};

export function calculateApplianceDelayStart(startISODatetime) {
    const currentDatetime = new Date();
    const startDatetime = new Date(startISODatetime);
    let diff = startDatetime.getTime() - currentDatetime.getTime();
    let hours = Math.floor(diff / 1000 / 60 / 60);
    diff -= hours * 1000 * 60 * 60;
    let minutes = Math.floor(diff / 1000 / 60);
    minutes = Math.round(minutes / 30) * 30;
    if (minutes == 60) {
        hours += 1;
        minutes = 0;
    }
    // If using time pickers with 24 hours format, add the below line get exact hours
    if (hours < 0) {
       hours = hours + 24;
    }
    return `${hours}h ${minutes}m`;
};