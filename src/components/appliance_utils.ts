"use strict";

import type { TimeFormat } from "./utils.ts";

export interface Appliance {
        id: string,
        name: string,
        power: number,
        runTime: TimeFormat,
        startAt?: Date,
        delayStart?: TimeFormat,
        cost?: number,
        };

export function calculateApplianceCost(appliance: Appliance, avg_cost: number) {
    const { hours, minutes } = appliance.runTime;
    let cost = avg_cost * (appliance.power / 1000) * (hours + (minutes / 60));
    cost = Math.round(cost * 10 + Number.EPSILON) / 10;
    appliance.cost = cost;
};

export function calculateApplianceDelayStart(appliance: Appliance) {
    const currentDatetime = new Date();
    let diff = appliance.startAt!.getTime() - currentDatetime.getTime();
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
    appliance.delayStart = {hours: hours, minutes: minutes};
};