"use strict";

import { Dexie } from 'dexie';
import type { Table } from 'dexie';
declare const CookiesEuBanner: any;

import { escapeHtml, validateInt, setCookie, getCookie, minMovingAverage, getLondonDayRangeAsDate, calculateConsumptionCost } from "./components/utils.ts";
import { getUnitData, getConsumptionData, initialiseUser, getStandingCharge } from "./components/api_methods.ts";
import { updateBar, updateKPI } from "./components/graph.ts";
import { calculateApplianceCost, calculateApplianceDelayStart } from "./components/appliance_utils.ts";

import type { BarProfile, GaugeProfile } from "./components/graph.ts";
import type { Appliance } from "./components/appliance_utils.ts";

import "./styles/styles.css";

let offset = 0;
let next_available = false;
let region: Region = "A";
let modal = null;
let appliances: Appliance[] = [{ id: 'default', name: 'Washing machine', power: 2000, runTime: { hours: 2, minutes: 30 } }];
const right = (document.getElementById("right") as HTMLInputElement);
const left = (document.getElementById("left") as HTMLInputElement);
let menuRotated = false;
let isMobile = false;
let selectedGraph: BarProfile = "unitBar";

type GaugeData = [string, number, GaugeProfile];


const regions = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P"] as const;

const regionMap: Record<string, string> = {
  A: "Eastern England",
  B: "East Midlands",
  C: "London",
  D: "Merseyside & Northern Wales",
  E: "West Midlands",
  F: "North Eastern England",
  G: "North Western England",
  H: "Southern England",
  J: "South Eastern England",
  K: "Southern Wales",
  L: "South Western England",
  M: "Yorkshire",
  N: "Southern Scotland",
  P: "Northern Scotland",
};

type RegionRow = {
  valid_from: Date;
  valid_to: Date;
  value_inc_vat: number;
};

type ConsumptionRow = {
  interval_start: Date;
  interval_end: Date;
  consumption: number;
};

type Region = typeof regions[number];

class TypedDB extends Dexie {
  consumption!: Table<ConsumptionRow, number>;

  constructor() {
    super("userData");

    const schema = "valid_from,valid_to,value_inc_vat";
    const storesDef: Record<string, string> = Object.fromEntries(
      regions.map((name) => [name, schema])
    );
    storesDef.consumption = "interval_start,interval_end,consumption";

    this.version(1).stores(storesDef);
  }
}

type RegionTables = {
  [K in Region]: Table<RegionRow, number>;
};

interface TypedDB extends RegionTables { }
const db = new TypedDB();

const schema = "valid_from,valid_to,value_inc_vat"
let storesDef = Object.fromEntries(
  regions.map(name => [name, schema])
);
storesDef.consumption = "interval_start,interval_end,consumption";
db.version(1).stores(storesDef);

async function getNextAvailable() {
  let tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0);
  let last_date = new Date((await db[region].orderBy("valid_from").last())!.valid_from);
  return (last_date.getTime() > tomorrow.getTime());
};

async function selectGraph(selected: BarProfile = "unitBar") {
  let unitButtonClassList = (document.getElementById("selectUnit") as HTMLButtonElement)!.classList;
  let consumptionClassList = (document.getElementById("selectConsumption") as HTMLButtonElement)!.classList;
  let costClassList = (document.getElementById("selectCost") as HTMLButtonElement)!.classList;
  selectedGraph = selected;
  if (selectedGraph === "unitBar") {
    const disabled = (offset == 1 || (offset == 0 && !next_available));
    right.disabled = disabled;
    unitButtonClassList.add("noHover", "unSelectedGraphType");
    consumptionClassList.remove("noHover", "unSelectedGraphType");
    costClassList.remove("noHover", "unSelectedGraphType");
  } else if (selectedGraph === "consumptionBar") {
    const disabled = (offset >= 0);
    right.disabled = disabled;
    unitButtonClassList.remove("noHover", "unSelectedGraphType");
    consumptionClassList.add("noHover", "unSelectedGraphType");
    costClassList.remove("noHover", "unSelectedGraphType");
  } else {
    unitButtonClassList.remove("noHover", "unSelectedGraphType");
    consumptionClassList.remove("noHover", "unSelectedGraphType");
    costClassList.add("noHover", "unSelectedGraphType");
    const disabled = (offset >= 0);
    right.disabled = disabled;
  }
  await updateGraphs(undefined, undefined);
};

function layoutCallback(e: any) {
  let select = document.getElementById("regionSelector") as HTMLSelectElement;
  let graphSelector = document.getElementById("graphSelector") as HTMLDivElement;
  let graphSelectorDesktopContainer = document.getElementById("graphContainer") as HTMLDivElement;
  let graphSelectorMobileContainer = document.getElementById("floatingControls") as HTMLDivElement;
  let buttonsMobileContainer = document.getElementById("buttonControls") as HTMLDivElement;
  let leftButtonDesktopContainer = document.getElementById("leftbcolumn") as HTMLDivElement;
  let rightButtonDesktopContainer = document.getElementById("rightbcolumn") as HTMLDivElement;
  let selectDesktopContainer = document.getElementById("navSelect") as HTMLDivElement;
  let selectMobileContainer = document.getElementById("settingsModal")!.querySelector(".modal-content") as HTMLDivElement;
  if (e.matches) { // Mobile
    let br = document.createElement("br");
    selectMobileContainer.prepend(select, br, br);
    graphSelectorMobileContainer.append(graphSelector);
    buttonsMobileContainer.prepend(right);
    buttonsMobileContainer.prepend(left);
    isMobile = true;
  } else {
    selectDesktopContainer.appendChild(select);
    graphSelectorDesktopContainer.prepend(graphSelector);
    rightButtonDesktopContainer.prepend(right);
    leftButtonDesktopContainer.prepend(left);
    selectDesktopContainer.style.visibility = "visible";
  }
  select.style.display = "inline-block";
  graphSelector.style.visibility = "visible";
};

async function storeUserData() {
  const apiKey = escapeHtml(((document.getElementById("APIKey") as HTMLInputElement)!).value);
  const accountNumber = escapeHtml(((document.getElementById("accountNumber") as HTMLInputElement)!).value);
  const mpan = escapeHtml(((document.getElementById("mpan") as HTMLInputElement)!).value) || undefined;
  const serialNumber = escapeHtml(((document.getElementById("serialNumber") as HTMLInputElement)!).value) || undefined;
  const rememberMe = ((document.getElementById("rememberMe") as HTMLInputElement)!).checked;
  let err = false;
  if (apiKey.length === 0 || accountNumber.length === 0)
    err = true;
  let res = await initialiseUser(accountNumber, apiKey, mpan, serialNumber, rememberMe);
  if (!res)
    err = true;
  if (err) {
    document.getElementById("settingsErr")!.style.display = "block";
    document.getElementById("manualDetailsEntry")!.style.display = "block";
    return;
  }
  document.getElementById("settingsErr")!.style.display = "none";
  (document.getElementById("selectConsumption") as HTMLButtonElement).classList.remove("noHover");
  (document.getElementById("selectCost") as HTMLButtonElement).classList.remove("noHover");
  closeModal();
};

async function getUserData(pf: Date, pt: Date) {
  // I can cache this better, it's fine if old data is stale, just need new current data.
  let now = (new Date());
  let errorMessageContainer = document.getElementById("noDataWarningMessage") as HTMLParagraphElement;
  if (!(pf.toDateString() === now.toDateString()) && pf.getTime() > now.getTime()) {
    errorMessageContainer.innerText = "No usage data for tomorrow yet, going back to today.";
    openModal("noDataWarning");
    await new Promise(r => setTimeout(r, 2000));
    closeModal();
    await buttonCb("left");
    right.disabled = true;
    return false;
  }
  let res = await db.consumption.where("interval_start").between(pf, pt, true, false).toArray();
  if (res.length < 48) {
    let new_pf = new Date(pf.valueOf());
    if (pf.toDateString() !== now.toDateString())
      new_pf.setDate(pt.getDate() - 30);
    res = (await getConsumptionData(new_pf, pt)).results;
    const convertedData = res.map(item => ({
      ...item,
      interval_start: new Date(item.interval_start),
      interval_end: new Date(item.interval_end)
    }));
    res = await db.consumption.bulkPut(convertedData).then(() => {
      return db.consumption.where("interval_start").between(pf, pt, true, false).toArray();
    });
    if (res.length === 0) {
      if (pf.toDateString() === now.toDateString()) {
        errorMessageContainer.innerText = "No data for today - try again later.";
        openModal("noDataWarning");
        await new Promise(r => setTimeout(r, 2000));
        closeModal();
        await buttonCb("left");
        right.disabled = true;
      } else {
        errorMessageContainer.innerText = "Missing data for this day - check with other methods.";
        openModal("noDataWarning");
      };
      return false;
      // No data, spawn no data div and disable buttons?
    }
  };
  return res;
}

async function getData(pf: Date, pt: Date, initial = false, direction = "right") {
  const t = new Date();
  let max = 30;
  if (initial)
    max = 3;
  let res = await db[region].where("valid_from").between(pf, pt, true, false).toArray();
  if (initial || (res.length !== 48 && !((pf.toDateString() == t.toDateString()) && res.length >= 40) && !((pf.getTime() > t.getTime()) && t.getHours() >= 16))) {
    let npf = new Date(pf.valueOf());
    let npt = new Date(pt.valueOf());
    if (direction === "left") {
      npf.setDate(npf.getDate() - max);
    } else {
      npt.setDate(npt.getDate() + max);
    };
    res = (await getUnitData(region, npf, npt)).results;
    const convertedData = res.map(item => ({
      ...item,
      valid_from: new Date(item.valid_from),
      valid_to: new Date(item.valid_to)
    }));
    res = await db[region].bulkPut(convertedData).then(() => {
      return db[region].where("valid_from").between(pf, pt, true, false).toArray();
    });
  };
  return res;
};

async function getStandingChargeData(pf: Date, pt: Date) {
  // This is stupid, no caching and will break on overlaps
  let res = await getStandingCharge(region, pf, pt);
  if (res === false) {
    // panic
  }
  return res.results[0].value_inc_vat;
}

async function buttonCb(id: string) {
  if (id == 'right') {
    offset += 1;
  } else {
    offset -= 1;
  }

  const disabled = (offset == 1 || (offset == 0 && !next_available));

  right.disabled = true;
  left.disabled = true;

  await updateGraphs(false, id);
  right.disabled = disabled;
  left.disabled = false;
};

async function updateGraphs(initial = false, direction = "right") {
  let standingCharge = 0;
  let dt_range = getLondonDayRangeAsDate(offset);
  if (selectedGraph === "unitBar") {
    var res: any[] = await getData(dt_range.start, dt_range.end, initial, direction);
    var data = res.map(a => a.value_inc_vat);
    var startTimes = res.map(a => new Date(a.valid_from));
    var startValue: GaugeData = ["Min price", Math.round(Math.min(...data) * 100 + Number.EPSILON) / 100 as number, "unitGauge"];
    var middleValue: GaugeData = ["Avg price", (Math.round((data.reduce((partialSum, a) => partialSum + a, 0) / data.length) * 100 + Number.EPSILON) / 100) as number, "unitGauge"];
    var endValue: GaugeData = ["Max price", Math.round(Math.max(...data) * 100 + Number.EPSILON) / 100 as number, "unitGauge"];
  } else if (selectedGraph === "consumptionBar") {
    let res: false | any[] = await getUserData(dt_range.start, dt_range.end);
    if (res === false)
      return;
    var data = res.map(a => a.consumption);
    var startTimes = res.map(a => new Date(a.interval_start));
    var startValue: GaugeData = ["Total consumption", data.reduce((partialSum, a) => partialSum + a, 0) as number, "consumptionGauge"];
    var middleValue: GaugeData = ["Avg consumption", Math.round((data.reduce((partialSum, a) => partialSum + a, 0) / data.length) * 1000 + Number.EPSILON) as number, "powerGauge"];
    var endValue: GaugeData = ["Max consumption", Math.round(Math.max(...data) * 1000 * 2 + Number.EPSILON) as number, "powerGauge"];
  } else {
    let res: false | any[] = await getUserData(dt_range.start, dt_range.end);
    if (res === false)
      return;
    var consumptionData = res.map(a => a.consumption);
    var startTimes = res.map(a => new Date(a.interval_start));
    res = await getData(dt_range.start, dt_range.end, initial, direction);
    var unitData = res.map(a => a.value_inc_vat);
    standingCharge = await getStandingChargeData(dt_range.start, dt_range.end);
    var data: any[] = calculateConsumptionCost(consumptionData, unitData);
    var startValue: GaugeData = ["Total day cost", data.reduce((partialSum, a) => partialSum + a, 0) + standingCharge as number, "totalCostGauge"];
    var middleValue: GaugeData = ["Min hourly cost", Math.round(Math.min(...data) + Number.EPSILON) as number, "costGauge"];
    var endValue: GaugeData = ["Max hourly cost", Math.round(Math.max(...data) + Number.EPSILON) as number, "costGauge"];
  };
  updateBar(startTimes, data, selectedGraph, initial, Math.round(standingCharge * 100 + Number.EPSILON) / 4800);
  updateKPI("start-kpi", ...startValue, initial);
  updateKPI("middle-kpi", ...middleValue, initial);
  updateKPI("end-kpi", ...endValue, initial);
  if (initial)
    document.getElementById("graphContainer")!.classList.add("show");
};

function spawnApplianceWidget(appliance: Appliance) {
  const widgetTemplate = document.getElementById("widgetTemplate");
  const applianceWidget = (widgetTemplate! as HTMLTemplateElement).content.cloneNode(true) as DocumentFragment;
  const applianceContainer = applianceWidget.querySelector('[data-type="applianceWidget"') as HTMLDivElement;
  applianceContainer.id = appliance.id;
  Object.keys(appliance).forEach(function (key) {
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
  let res = await getData(period_from, period_to);
  let unit = res.map(a => a.value_inc_vat);
  let valid_from = res.map(a => a.valid_from);
  let cheapestWindow = minMovingAverage(unit, intervals);
  const avg_cost = Math.round(cheapestWindow.sum * 100 + Number.EPSILON) / (100 * intervals);

  const startTime = new Date(valid_from.at(cheapestWindow.startIndex)!);
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
  Object.keys(fields).forEach(function (key) {
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
    document.getElementById("applianceErr")!.style.display = "block";
    return;
  };
  document.getElementById("applianceErr")!.style.display = "none";

  let new_appliance = {
    id: self.crypto.randomUUID(),
    name: appliance_name,
    runTime: { hours: appliance_hours, minutes: appliance_minutes },
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

(async () => {

  document.addEventListener("DOMContentLoaded", async function () {
    region = getCookie("region", "A");
    (document.getElementById("regionSelector") as HTMLInputElement)!.value = region;
    (document.getElementById("selectedRegion") as HTMLSpanElement).textContent = regionMap[region];

    new CookiesEuBanner(function () {
      appliances = JSON.parse(localStorage.getItem("appliances")!) || appliances;
    });

    let gather_futs: Promise<void>[] = [];

    await updateGraphs(true);
    next_available = (await getNextAvailable());

    right.disabled = !next_available;

    for (let appliance of appliances) {
      gather_futs.push(addAppliance(appliance));
    };

    if (appliances.length > 7) {
      ((document.getElementById("newAppliance") as HTMLInputElement)!).disabled = true;
    };

    await Promise.all(gather_futs);

    if (await initialiseUser()) {
      (document.getElementById("selectConsumption") as HTMLButtonElement).classList.remove("noHover");
      (document.getElementById("selectCost") as HTMLButtonElement).classList.remove("noHover");
    } else {
      localStorage.removeItem("userInfo");
    }

    left.addEventListener("click", () => { buttonCb('left') });
    right.addEventListener("click", () => { buttonCb('right') });

    document.getElementById("regionSelector")!.addEventListener("change", async (event) => {
      region = ((event.target as HTMLInputElement)!).value as Region;
      (document.getElementById("selectedRegion") as HTMLSpanElement).textContent = regionMap[region];
      setCookie("region", ((event.target as HTMLInputElement)!).value, 365);

      let gather_futs: Promise<void>[] = [];

      let dt_range = getLondonDayRangeAsDate(0);
      await getData(dt_range.start, dt_range.end, true);
      await updateGraphs();

      for (let appliance of appliances) {
        gather_futs.push(updateAppliance(appliance, true));
      };

      await Promise.all(gather_futs);
    });

    const mediaQuery = window.matchMedia("(max-width: 1100px)");
    layoutCallback(mediaQuery);

    mediaQuery.addEventListener("change", layoutCallback);
    (document.getElementById("newAppliance")!).addEventListener("click", () => { openModal("applianceModal") });
    (document.getElementById("addApplianceButton")!).addEventListener("click", () => { parseAppliance() });
    (document.getElementById("settingsButton")!).addEventListener("click", () => { openModal("settingsModal") });
    (document.getElementById("addDetailsButton")!).addEventListener("click", () => { storeUserData() });
    (document.getElementById("selectUnit")!).addEventListener("click", () => { selectGraph("unitBar") });
    (document.getElementById("selectConsumption")!).addEventListener("click", () => { selectGraph("consumptionBar") });
    (document.getElementById("selectCost")!).addEventListener("click", () => { selectGraph("costBar") });

    let settingsMenu = document.getElementById("settingsMenu")!;
    settingsMenu.addEventListener("click", () => { openModal("settingsModal") });
    settingsMenu.addEventListener("click", () => { rotateMenuIcon() });

    let closeModalArr = document.getElementsByClassName("closeModal");
    for (var i = 0; i < closeModalArr.length; i++)
      closeModalArr[i].addEventListener("click", () => { closeModal() });

    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function (event) {
      if (event.target == modal!) {
        closeModal();
      }
    }
  });
})()
