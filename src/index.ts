"use strict";

import { Dexie } from 'dexie';
declare const CookiesEuBanner: any;

import { escapeHtml, validateInt, setCookie, getCookie, minMovingAverage, toLondonISOString, getLondonDayRangeAsDate } from "./components/utils.ts";
import { getUnitData, getConsumptionData, initialiseUser } from "./components/api_methods.ts";
import {updateBar, updateKPI } from "./components/graph.ts";
import type { Appliance } from "./components/appliance_utils.ts";
import { calculateApplianceCost, calculateApplianceDelayStart } from "./components/appliance_utils.ts";

let offset = 0;
let next_available = false;
let region = "A";
let regions = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P"]
let modal = null;
let appliances: Appliance[] = [{id: 'default', name: 'Washing machine', power: 2000, runTime: {hours: 2, minutes: 30}}];
const right = (document.getElementById("right") as HTMLInputElement);
const right_floating = (document.getElementById("right-floating") as HTMLInputElement);
const left = (document.getElementById("left") as HTMLInputElement);
const left_floating = (document.getElementById("left-floating") as HTMLInputElement);
let menuRotated = false;
let isMobile = false;
let selectedGraph = "unit";

let db = new Dexie("userData");

const schema = "valid_from,valid_to,value_inc_vat"
let storesDef = Object.fromEntries(
  regions.map(name => [name, schema])
);
storesDef.consumption = "interval_start,interval_end,consumption";
db.version(1).stores(storesDef);

async function getNextAvailable() {
    let tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    // @ts-ignore
    let last_date = new Date((await db[region].orderBy("valid_from").last()).valid_from);
    return (last_date.getTime() > tomorrow.getTime());
};

async function selectGraph(selected: string = "unit") {
    selectedGraph = selected;
    await updateGraphs(undefined, undefined);
};

function moveSelect(e: any) {
    let select = document.getElementById("region") as HTMLSelectElement;
    let desktopContainer = document.getElementById("navSelect") as HTMLDivElement;
    let mobileContainer = document.getElementById("modalContent") as HTMLDivElement;
    if (e.matches) {
        // Mobile
        let br = document.createElement("br");
        mobileContainer.prepend(select, br, br);
        select.style.display = "inline-block";
        isMobile = true;
    } else {
        // Desktop
        desktopContainer.appendChild(select);
        desktopContainer.style.visibility = "visible";
        select.style.display = "inline-block";
    }
};

async function storeUserData() {
    const apiKey = escapeHtml(((document.getElementById("APIKey") as HTMLInputElement)!).value);
    const accountNumber = escapeHtml(((document.getElementById("accountNumber") as HTMLInputElement)!).value);
    const rememberMe = ((document.getElementById("rememberMe") as HTMLInputElement)!).checked;
    await initialiseUser(accountNumber, apiKey, rememberMe);
};

async function getUserData(pf: Date, pt: Date) {
    // @ts-ignore
    let res = await db.consumption.where("interval_start").between(pf.toISOString(), pt.toISOString(), true, false).toArray();
    if (res.length === 0) {
        let new_pf = new Date(pf.valueOf());
        new_pf.setDate(pt.getDate() - 30);
        res = (await getConsumptionData(new_pf, pt)).results;
        // @ts-ignore
        res = await db.consumption.bulkPut(res).then(() => {
            // @ts-ignore
            return db.consumption.where("interval_start").between(pf.toISOString(), pt.toISOString(), true, false).toArray();
        });
    };
    return res;
}

async function getData(pf: Date, pt: Date, initial = false, direction = "right") {
    const t = new Date();
    let max = 30;
    if (initial)
        max = 1;
    // @ts-ignore
    let res = await db[region].where("valid_from").between(pf.toISOString(), pt.toISOString(), true, false).toArray();
    if (res.length !== 48 && !((pf.toDateString() == t.toDateString()) && res.length >= 40) && !((pf.getTime() > t.getTime()) && t.getHours() >= 16)) {
        let npf = new Date(pf.valueOf());
        let npt = new Date(pt.valueOf());
        if (direction === "left" ) {
            npf.setDate(npf.getDate() - max);
        } else {
            npt.setDate(npt.getDate() + max);
        };
        res = (await getUnitData(region, npf, npt)).results;
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

    right.disabled = true;
    right_floating.disabled = true;
    left.disabled = true;
    left_floating.disabled = true;

    await updateGraphs(false, id);

    right.disabled = disabled;
    right_floating.disabled = disabled;
    left.disabled = false;
    left_floating.disabled = false;
};

async function updateGraphs(initial = false, direction = "right") {

    var min: [string, number];
    var max: [string, number];
    var average: [string, number];
    let x, valid_from, suffix, specialSuffix, barRange, KPIRange, specialKPIRange;
    let dt_range = getLondonDayRangeAsDate(offset);
    if (selectedGraph === "unit") {
        let res: any[] = await getData(dt_range.start, dt_range.end, initial, direction);
        x = res.map(a => a.value_inc_vat);
        valid_from = res.map(a => a.valid_from);
        min = ["Minimum price", Math.round(Math.min(...x) * 100 + Number.EPSILON) / 100 as number];
        max = ["Maximum price", Math.round(Math.max(...x) * 100 + Number.EPSILON) / 100 as number];
        average = ["Average price", (Math.round((x.reduce((partialSum, a) => partialSum + a, 0) / x.length) * 100 + Number.EPSILON) / 100) as number];
        suffix = "p";
    } else {
        let res: any[] = await getUserData(dt_range.start, dt_range.end);
        x = res.map(a => a.consumption);
        min = ["Total consumption", x.reduce((partialSum, a) => partialSum + a, 0) as number];
        max = ["Maximum consumption", Math.round(Math.max(...x) * 1000 * 2 + Number.EPSILON) as number];
        average = ["Average consumption", Math.round((x.reduce((partialSum, a) => partialSum + a, 0) / x.length) * 1000 + Number.EPSILON) as number];
        valid_from = res.map(a => a.interval_start);
        specialSuffix = "W";
        suffix = "kWh";
        //@ts-ignore
        barRange = [0, Math.max(1, max.at(1) / 1500)];
        specialKPIRange = [0, 100];
        KPIRange = [0, 3000];
    };
    let london_valid_from = valid_from.map(toLondonISOString);
    updateBar(london_valid_from, x, suffix, undefined, undefined, initial, barRange);
    //@ts-ignore
    updateKPI("min", min.at(1), average.at(1), min.at(0), suffix, initial, specialKPIRange || KPIRange);
    //@ts-ignore
    updateKPI("avg", average.at(1), average.at(1), average.at(0), specialSuffix || suffix, initial, KPIRange);
    //@ts-ignore
    updateKPI("max", max.at(1), average.at(1), max.at(0), specialSuffix || suffix, initial, KPIRange);

    if (initial)
        document.getElementById("graphContainer")!.classList.add("show");
};

function spawnApplianceWidget(appliance: Appliance) {
    const widgetTemplate = document.getElementById("widgetTemplate");
    const applianceWidget = (widgetTemplate! as HTMLTemplateElement).content.cloneNode(true) as DocumentFragment;
    const applianceContainer = applianceWidget.querySelector('[data-type="applianceWidget"') as HTMLDivElement;
    applianceContainer.id = appliance.id;
    Object.keys(appliance).forEach(function(key) {
        if (["id", "startAt", "runTime"].includes(key)) return;
        var applianceField = applianceContainer.querySelector(`[data-field="${key}"]`) as HTMLParagraphElement;
        applianceField.textContent = String(appliance[key as keyof Appliance]);
        });
    const span = applianceContainer.getElementsByClassName("close")[0];
    span.addEventListener("click", () => { removeAppliance(appliance) });  
    document.getElementById("dynamicBlockGrid")!.appendChild(applianceContainer);
};

async function updateAppliance(appliance: Appliance, initial = false) {
    let period_from = new Date();
    let period_to = new Date(period_from.valueOf());
    period_to.setDate(period_from.getDate() + 2);
    const intervals = appliance.runTime.hours * 2 + Math.ceil(appliance.runTime.minutes / 30);
    // @ts-ignore
    let res = await getData(period_from, period_to);
    // @ts-ignore
    let unit = res.map(a => a.value_inc_vat);
    // @ts-ignore
    let valid_from = res.map(a => a.valid_from);
    let cheapestWindow = minMovingAverage(unit, intervals);
    const avg_cost = Math.round(cheapestWindow.sum * 100 + Number.EPSILON) / (100 * intervals);

    const startTime = new Date(valid_from.at(cheapestWindow.startIndex));
    appliance.startAt = startTime;
    calculateApplianceCost(appliance, avg_cost);
    calculateApplianceDelayStart(appliance);

    const start_day = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(appliance.startAt);

    const startHour = ("0" + appliance.startAt.getHours()).slice(-2);
    const startMinute = ("0" + appliance.startAt.getMinutes()).slice(-2);

    const fields: any = {
        startAt: `${start_day} ${startHour}:${startMinute}`,
        hours: `${appliance.runTime!.hours}`,
        minutes: `${appliance.runTime!.minutes}`,
        delayStart: `${appliance.delayStart!.hours}h ${appliance.delayStart!.minutes}m`,
        cost: String(appliance.cost),
    };
    
    const applianceContainer = document.getElementById(appliance.id)!;
    Object.keys(fields).forEach(function(key) {
        var applianceField = applianceContainer.querySelector(`[data-field="${key}"]`) as HTMLParagraphElement;
        applianceField.textContent = String(fields[key]);
        });
    
    if (!next_available) {
        var warn = applianceContainer.querySelector('[data-field="warning"]') as HTMLSpanElement;
        warn.style.display = "inline-block";
    };
    if (initial) {
        requestAnimationFrame(() => {
            applianceContainer.classList.add("show");
        });
    };
};

async function parseAppliance() {
    const appliance_name = escapeHtml(((document.getElementById("appName") as HTMLInputElement)!).value);
    const appliance_power = validateInt(escapeHtml(((document.getElementById("appPower") as HTMLInputElement)!).value), 0, 20000);
    const appliance_hours = validateInt(escapeHtml(((document.getElementById("appRunHours") as HTMLInputElement)!).value), 0, 16);
    const appliance_minutes = validateInt(escapeHtml(((document.getElementById("appRunMinutes") as HTMLInputElement)!).value), 0, 59);
    
    if (appliance_power == -1 || appliance_hours == -1 || appliance_minutes == -1) {
        const err = document.getElementById("applianceErr")!;
        err.style.display = "block";
        return;
    };

    let new_appliance = {
        id: self.crypto.randomUUID(),
        name: appliance_name,
        runTime: {hours: appliance_hours, minutes: appliance_minutes},
        power: appliance_power,
        };

    appliances.push(new_appliance);

    new CookiesEuBanner(function () {
        localStorage.setItem("appliances", JSON.stringify(appliances));
    });
    
    if (appliances.length > 7) {
        ((document.getElementById("newAppliance") as HTMLInputElement)!).disabled = true;
    };

    await addAppliance(new_appliance);
    closeModal();
};

async function addAppliance(new_appliance: Appliance) {
    spawnApplianceWidget(new_appliance);
    await updateAppliance(new_appliance, true);
};

function removeAppliance(appliance: Appliance) {
    let applianceContainer = document.getElementById(appliance.id) as HTMLDivElement;
    applianceContainer.classList.remove("show");
    applianceContainer.addEventListener("transitionend", () => {
      applianceContainer.remove();
    });
    var index = appliances.indexOf(appliance);
    appliances.splice(index, 1);
    localStorage.setItem("appliances", JSON.stringify(appliances));
    if (appliances.length < 8) {
        ((document.getElementById("newAppliance") as HTMLInputElement)!).disabled = false;
    }
};

function rotateMenuIcon(override: boolean | null = null) {
    menuRotated = override || !menuRotated; // toggle state
    document.getElementById("settingsMenu")!.style.transform = menuRotated ? "rotate(-90deg)" : "rotate(0deg)";
}

function closeModal() {
    let modalContent = modal!.querySelector(".modal-content");
    modalContent.classList.remove("show");
    modalContent.addEventListener("transitionend", () => {
        modal!.style.visibility = "hidden";
        if (modal!.id === "settingsModal" && isMobile)
            rotateMenuIcon(false);
    }, { once: true });
  };

function openModal(id: string) {
    modal = document.getElementById(id)! as HTMLDivElement;
    requestAnimationFrame(() => {
        modal!.querySelector(".modal-content")!.classList.add("show");
    });
    modal.style.visibility = "visible";
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

        let stored = await initialiseUser(); // do something with the result (I.E if found)
        console.log(stored);

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
                gather_futs.push(updateAppliance(appliance, true));
            };

            await Promise.all(gather_futs);
        });

        const mediaQuery = window.matchMedia("(max-width: 1100px)");
        moveSelect(mediaQuery);

        mediaQuery.addEventListener("change", moveSelect);
        (document.getElementById("newAppliance")!).addEventListener("click", () => { openModal("applianceModal") });
        (document.getElementById("addApplianceButton")!).addEventListener("click", () => { parseAppliance() });
        (document.getElementById("settingsButton")!).addEventListener("click", () => { openModal("settingsModal") });
        (document.getElementById("addDetailsButton")!).addEventListener("click", () => { storeUserData() });
        (document.getElementById("selectUnit")!).addEventListener("click", () => { selectGraph("unit") });
        (document.getElementById("selectConsumption")!).addEventListener("click", () => { selectGraph("consumption") });

        let settingsMenu = document.getElementById("settingsMenu")!;
        settingsMenu.addEventListener("click", () => { openModal("settingsModal") });
        settingsMenu.addEventListener("click", () => { rotateMenuIcon() });
        
        let closeModalArr = document.getElementsByClassName("closeModal");
        for (var i = 0; i < closeModalArr.length; i++)
            closeModalArr[i].addEventListener("click", () => { closeModal() });
        
        // When the user clicks anywhere outside of the modal, close it
        window.onclick = function(event) {
            if (event.target == modal!) {
                closeModal();
            }
        } 
    });
  })()
