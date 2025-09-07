"use strict";

import { Dexie } from 'dexie';
declare const CookiesEuBanner: any;

import { escapeHtml, validateInt, setCookie, getCookie, minMovingAverage, toLondonISOString, getLondonTimeParts, getLondonDayRangeAsDate } from "./components/utils.js";
import { getUnitData } from "./components/api_methods.js";
import { updatebar, updatekpi } from "./components/graph.js";
// import { } from "./modules/appliance_utils.js";


let offset = 0;
let next_available = false;
let region = "A";
let regions = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P"]
let modal = document.getElementById("newApplianceModal")!;
let appliances = [{id: 'default', name: 'Washing machine', power: 2000, hours: 2, minutes: 30}];
const right = (document.getElementById("right") as HTMLInputElement);
const right_floating = (document.getElementById("right-floating") as HTMLInputElement);
const left = (document.getElementById("left") as HTMLInputElement);
const left_floating = (document.getElementById("left-floating") as HTMLInputElement);

let db = new Dexie("userData");

const schema = "valid_from,valid_to,value_inc_vat"
const storesDef = Object.fromEntries(
  regions.map(name => [name, schema])
);

db.version(1).stores(storesDef);

async function getNextAvailable() {
    let tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    // @ts-ignore
    let last_date = new Date((await db[region].orderBy("valid_from").last()).valid_from);
    return (last_date.getTime() > tomorrow.getTime());
};

async function getData(pf: Date, pt: Date, initial = false) {
    const t = new Date();
    let max = 30;
    if (initial)
        max = 1;
    // @ts-ignore
    let res = await db[region].where("valid_from").between(pf.toISOString(), pt.toISOString(), true, false).toArray();
    if (res.length !== 48 && !((pf.toDateString() == t.toDateString()) && res.length >= 40) && !((pf.getTime() > t.getTime()) && t.getHours() >= 16)) {
        let new_period_from = new Date(pf.valueOf());
        new_period_from.setDate(pf.getDate() - max);
        let new_period_to = new Date(pt.valueOf());
        if (initial)
            new_period_to.setDate(new_period_to.getDate() + Math.abs(offset) + 1);
        res = (await getUnitData(region, new_period_from, new_period_to)).results;
        // @ts-ignore
        res = await db[region].bulkPut(res).then(() => {
            // @ts-ignore
           return db[region].where("valid_from").between(pf.toISOString(), pt.toISOString(), true, false).toArray();
        });
    };
    return res;
};

async function buttonCb(id: string) {
    if (id == 'right') {
        offset += 1;
    } else {
        offset -= 1;
    }

    const disabled = (offset == 1 || (offset == 0 && !next_available));

    right.disabled = disabled;
    right_floating.disabled = disabled;
    left.disabled = true;
    left_floating.disabled = true;

    await updateGraphs();

    left.disabled = false;
    left_floating.disabled = false;
};

async function updateGraphs(initial = false) {
    let dt_range = getLondonDayRangeAsDate(offset);
    let res = await getData(dt_range.start, dt_range.end, initial);
    // @ts-ignore
    let unit = res.map(a => a.value_inc_vat);
    // @ts-ignore
    let valid_from = res.map(a => a.valid_from);

    const min_price = Math.round(Math.min(...unit) * 100 + Number.EPSILON) / 100;
    const max_price = Math.round(Math.max(...unit) * 100 + Number.EPSILON) / 100;
    // @ts-ignore
    const average_price = Math.round((unit.reduce((partialSum, a) => partialSum + a, 0) / unit.length) * 100 + Number.EPSILON) / 100;

    let london_valid_from = valid_from.map(toLondonISOString);

    updatebar(london_valid_from, unit);
    updatekpi("min", min_price, average_price, "Minimum");
    updatekpi("avg", average_price, average_price, "Average");
    updatekpi("max", max_price,average_price, "Maximum");
  };

function spawnApplianceWidget(appliance: any) {
    const frag = document.createDocumentFragment();
    const appliance_widget = document.createElement("div");
    appliance_widget.className = "gridDynamicItem gridHeight";
    appliance_widget.id = appliance.id;
    appliance_widget.style.display = "none";
    var span = document.createElement("span");
    span.innerHTML = "&times;";
    span.className = "close";
    span.addEventListener("click", () => { removeApplianceWidget(appliance) });
    appliance_widget.appendChild(span);
    var p = document.createElement("p");
    p.innerHTML = `${appliance.name}<br>${appliance.power}W`;
    p.className = "quicksand-txt title";
    appliance_widget.appendChild(p);
    var para = document.createElement("p");
    para.className = "start quicksand-txt";
    appliance_widget.appendChild(para);
    para = document.createElement("p");
    para.className = "delayStart quicksand-txt";
    appliance_widget.appendChild(para);
    frag.appendChild(appliance_widget);
    para = document.createElement("p");
    para.innerHTML = `For ${appliance.hours} hours ${appliance.minutes} minutes`;
    para.className = "quicksand-txt";
    appliance_widget.appendChild(para);
    para = document.createElement("p");
    para.className = "cost quicksand-txt";
    para.style.display = "inline-block";
    appliance_widget.appendChild(para);
    frag.appendChild(appliance_widget);
    document.getElementById("dynamicBlockGrid")!.appendChild(frag);
  };

function removeApplianceWidget(appliance: any) {
    document.getElementById(appliance.id)!.remove();
    var index = appliances.indexOf(appliance);
    appliances.splice(index, 1);
    localStorage.setItem("appliances", JSON.stringify(appliances));
    if (appliances.length < 8) {
        ((document.getElementById("newAppliance") as HTMLInputElement)!).disabled = false;
    }
};

function calculateApplianceCost(appliance: any, avg_cost: number) {
    let cost = avg_cost * (appliance.power / 1000) * (appliance.hours + (appliance.minutes / 60));
    cost = Math.round(cost * 10 + Number.EPSILON) / 10;
    return cost;
};

function calculateApplianceDelayStart(startISODatetime: string) {
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

async function updateAppliance(appliance: any) {
    let period_from = new Date();
    const intervals = appliance.hours * 2 + Math.ceil(appliance.minutes / 30);

    // @ts-ignore
    let res = await db[region].where("valid_from").above(period_from.toISOString()).toArray();

    // @ts-ignore
    let unit = res.map(a => a.value_inc_vat);
    // @ts-ignore
    let valid_from = res.map(a => a.valid_from);

    res = minMovingAverage(unit, intervals);

    let avg_cost = Math.round(res.sum * 100 + Number.EPSILON) / (100 * intervals);
    let start_time = valid_from.at(res.startIndex);

    let cost = calculateApplianceCost(appliance, avg_cost);

    const delay_start = calculateApplianceDelayStart(start_time);
    const appliance_widget = document.getElementById(appliance.id)!;
    const delay_start_para= appliance_widget.querySelector(".delayStart")!;
    delay_start_para.innerHTML = `(A delay start of ${delay_start})`;
    const cost_para = appliance_widget.querySelector(".cost")!;
    if (next_available) {
        cost_para.innerHTML = `At a cost of <b>${cost}p</b>`;
    } else {
        cost_para.innerHTML = `At a cost of <b>${cost}p</b>&nbsp;<span class="material-symbols-outlined warning-span tooltip">warning<span class="tooltiptext quicksand-txt">Tomorrow's pricing hasn't<br>been released yet.<br>Check back at 16:00<br>for an updated start time!</span></span>`;
    }
    const start_para = appliance_widget.querySelector(".start")!;
    const parsed_start_time = new Date(start_time);
    const hour_minute = getLondonTimeParts(start_time);
    const start_day = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parsed_start_time);
    const hours = ("0" + hour_minute.hour).slice(-2);
    const minutes = ("0" + hour_minute.minute).slice(-2);
    start_para.innerHTML = `Start at <b>${start_day} ${hours}:${minutes}</b>`;
    appliance_widget.style.display = "block";
};

async function addAppliance(new_appliance: any = null) {
    if (new_appliance == null) {
        const appliance_name = escapeHtml(((document.getElementById("appName") as HTMLInputElement)!).value);
        const appliance_power = validateInt(escapeHtml(((document.getElementById("appPower") as HTMLInputElement)!).value), 0, 20000);
        const appliance_hours = validateInt(escapeHtml(((document.getElementById("appRunHours") as HTMLInputElement)!).value), 0, 16);
        const appliance_minutes = validateInt(escapeHtml(((document.getElementById("appRunMinutes") as HTMLInputElement)!).value), 0, 59);
        
        if (appliance_power == -1 || appliance_hours == -1 || appliance_minutes == -1) {
            const err = document.getElementById("applianceErr")!;
            err.style.display = "block";
            return;
        }

        new_appliance = {
            id: self.crypto.randomUUID(),
            name: appliance_name,
            power: appliance_power,
            hours: appliance_hours,
            minutes: appliance_minutes,
            };

        appliances.push(new_appliance);

        new CookiesEuBanner(function () {
            localStorage.setItem("appliances", JSON.stringify(appliances));
        });
        
        if (appliances.length > 7) {
            ((document.getElementById("newAppliance") as HTMLInputElement)!).disabled = true;
        }};

    spawnApplianceWidget(new_appliance);
    await updateAppliance(new_appliance);
    closeApplianceModal();
  };

function closeApplianceModal() {
    modal.style.display = "none";
  };

function newAppliance() {
    modal.style.display = "block";
  };

(async() => {

    document.addEventListener("DOMContentLoaded", async function () {
        ((document.getElementById("region") as HTMLInputElement)!).value = getCookie("region", "A");
        
        region = getCookie("region", "A");

        new CookiesEuBanner(function () {
            appliances = JSON.parse(localStorage.getItem("appliances")!) || appliances;
        });
        
        let gather_futs: Promise<void>[] = [];

        await updateGraphs(true);

        next_available = (await getNextAvailable());

        right.disabled = !next_available;
        right_floating.disabled = !next_available;

        for (let appliance of appliances) {
            gather_futs.push(addAppliance(appliance));
        };

        if (appliances.length > 7) {
        ((document.getElementById("newAppliance") as HTMLInputElement)!).disabled = true;
        };

        await Promise.all(gather_futs);

        left.addEventListener("click", () => { buttonCb('left') });
        left_floating.addEventListener("click", () => { buttonCb('left') });
        right.addEventListener("click", () => { buttonCb('right') });
        right_floating.addEventListener("click", () => { buttonCb('right') });

        document.getElementById("region")!.addEventListener("change", async(event) => {
            region = ((event.target as HTMLInputElement)!).value;
            setCookie("region", ((event.target as HTMLInputElement)!).value, 365);

            let gather_futs: Promise<void>[] = [];

            let dt_range = getLondonDayRangeAsDate(0);
            await getData(dt_range.start, dt_range.end, true); // needed for appliance calcs
            await updateGraphs();
            
            for (let appliance of appliances) {
                gather_futs.push(updateAppliance(appliance));
            };

            await Promise.all(gather_futs);
        });

        (document.getElementById("newAppliance")!).addEventListener("click", () => { newAppliance() });
        (document.getElementById("addApplianceButton")!).addEventListener("click", () => { addAppliance() }); 
        (document.getElementById("closeModal")!).addEventListener("click", () => { closeApplianceModal() });
        
        // When the user clicks anywhere outside of the modal, close it
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = "none";
            }
        } 
    });
  })()
