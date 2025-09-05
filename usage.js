"use strict";

import { escapeHtml, getNextAvailable, getPricingData, getMeter, getConsumptionData} from "./modules/utils.js";
import { updatebar, updatekpi } from "./modules/graph.js";

let offset = -3;
let next_available = false;
let userInfo = {};
let db = new Dexie("userData");

db.version(1).stores({
    consumption: `
    interval_start,
    interval_end,
    consumption`,
});

async function buttonCb(id) {
    if (id == 'right') {
        offset += 1;
    }
    else {
        offset -= 1;
    }
    if ( offset == 1 ){
        document.getElementById("right").disabled = true;
        document.getElementById("right-floating").disabled = true;
    }
    else if ( offset == 0 && !next_available ){
        document.getElementById("right").disabled = true;
        document.getElementById("right-floating").disabled = true;
    }
    else {
        document.getElementById("right").disabled = false;
        document.getElementById("right-floating").disabled = false;
    }

    await updateGraphs();
}

async function updateGraphs() {
    let res = await fetchData();
    let consumption = res.map(a => a.consumption);
    let start = res.map(a => a.interval_start);

    const total_consumption = Math.round(consumption.reduce((partialSum, a) => partialSum + a, 0) * 100 + Number.EPSILON) / 100;
    const max_consumption = Math.round(Math.max(...consumption) * 1000 + Number.EPSILON);
    const average_consumption = Math.round((total_consumption / 24) * 100 + Number.EPSILON) / 100; // bad

    updatebar(start, consumption, "kWh", -2, 3);
    updatekpi("total", total_consumption, total_consumption * 3, "Total consumption", "kWh");
    updatekpi("avg", average_consumption * 1000, total_consumption * 1000, "Average consumption", "W");
    updatekpi("max", max_consumption, total_consumption * 1000, "Max Consumption", "W");

};

async function fetchData() {
    let period_to = new Date();
    period_to.setHours(0, 30, 0, 0);
    let period_from = new Date(period_to.valueOf());
    period_to.setDate(period_to.getDate() + offset);
    period_from.setDate(period_from.getDate() - 1 + offset);
    let res = await db.consumption.where("interval_start").between(period_from.toISOString(), period_to.toISOString(), true, false).toArray();
    console.log(period_from.toISOString(), period_to.toISOString(), res);
    if (res.length === 0) {
        if (!Object.hasOwn(userInfo, "mpan"))
            await fetchDetails();
        period_from.setDate(period_from.getDate() - 180 + offset);
        res = (await getConsumptionData(userInfo, period_from, period_to)).results;
        db.consumption.bulkPut(res);
    }
    return res;
};

async function fetchDetails() {
    userInfo.apiKey  = escapeHtml(document.getElementById("api").value);
    userInfo.accountNumber = escapeHtml(document.getElementById("acc").value);
    document.getElementById("success").style.display = "block";
    let res = await getMeter(userInfo);
    const meter_info = res.properties[0].electricity_meter_points[0];
    userInfo.mpan = meter_info.mpan;
    userInfo.serialNumber = meter_info.meters.at(-1).serial_number;
};

(async() => {
    next_available = (await getNextAvailable())['res'];
    if ( !(next_available) ){
        document.getElementById("right").disabled = true;
        document.getElementById("right-floating").disabled = true;
    };

    document.getElementById("left").addEventListener("click", () => { buttonCb('left') });
    document.getElementById("right").addEventListener("click", () => { buttonCb('right') });
    document.getElementById("left-floating").addEventListener("click", () => { buttonCb('left') });
    document.getElementById("right-floating").addEventListener("click", () => { buttonCb('right') });
    document.getElementById("accInfo").addEventListener("click", () => fetchData());

    if (await db.consumption.count()) {
        await updateGraphs();
    };

  })()
