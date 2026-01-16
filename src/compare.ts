"use strict";

declare const CookiesEuBanner: any;

import { state } from "./components/state.ts";
import { setCookie, getCookie, getLondonDayRangeAsDate, calculateConsumptionCost, rotateMenuIcon } from "./components/utils.ts";
import { getConsumptionData, initialiseUser } from "./components/api_methods.ts";
import { getNextAvailable, getData, getGo, getStandingChargeData } from "./components/data_methods.ts";
import { updateBar, updateKPI } from "./components/graph.ts";
import { addAppliance, updateAppliance, parseAppliance } from "./components/appliance_methods.ts";
import { db } from "./components/db.ts";
import { regionMap } from "./components/db_types.ts";
import { openModal, closeModal } from "./components/modal_logic.ts";
import { storeUserData } from "./components/api_methods.ts";

import type { Region } from "./components/db_types.ts";
import type { BarProfile, GaugeProfile } from "./components/graph.ts";

import "./styles/styles.css";

let offset = 0;
const right = (document.getElementById("right") as HTMLInputElement);
const left = (document.getElementById("left") as HTMLInputElement);
let selectedGraph: BarProfile = "unitBar";

type GaugeData = [string, number, GaugeProfile];

async function selectGraph(selected: BarProfile = "unitBar") {
  let unitButtonClassList = (document.getElementById("selectUnit") as HTMLButtonElement)!.classList;
  let consumptionClassList = (document.getElementById("selectConsumption") as HTMLButtonElement)!.classList;
  let costClassList = (document.getElementById("selectCost") as HTMLButtonElement)!.classList;
  selectedGraph = selected;
  if (selectedGraph === "unitBar") {
    const disabled = (offset == 1 || (offset == 0 && !state.nextAvailable));
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
    state.isMobile = true;
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

async function buttonCb(id: string) {
  if (id == 'right') {
    offset += 1;
  } else {
    offset -= 1;
  }

  const disabled = (offset == 1 || (offset == 0 && !state.nextAvailable));

  right.disabled = true;
  left.disabled = true;

  await updateGraphs(false, id);
  right.disabled = disabled;
  left.disabled = false;
};

async function updateGraphs(initial = false, direction = "right") {
  let standingCharge = 0;
  let dt_range = getLondonDayRangeAsDate(offset);
  let resGo: any[] = await getGo(dt_range.start, dt_range.end);
  let goData = resGo.map(a => a.value_inc_vat);
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
    var totalCost = data.reduce((partialSum, a) => partialSum + a, 0) + standingCharge as number;
    var startValue: GaugeData = ["Total day cost", totalCost / 100, "totalCostGauge"];
    var middleValue: GaugeData = ["Min hourly cost", Math.round(Math.min(...data) + Number.EPSILON) as number, "costGauge"];
    var endValue: GaugeData = ["Max hourly cost", Math.round(Math.max(...data) + Number.EPSILON) as number, "costGauge"];
  };
  updateBar(startTimes, data, selectedGraph, initial, Math.round(standingCharge * 100 + Number.EPSILON) / 4800, goData, "compareBar");
  updateKPI("start-kpi", ...startValue, initial);
  updateKPI("middle-kpi", ...middleValue, initial);
  updateKPI("end-kpi", ...endValue, initial);
  if (initial)
    document.getElementById("graphContainer")!.classList.add("show");
};

(async () => {

  document.addEventListener("DOMContentLoaded", async function () {
    state.region = getCookie("region", "A");
    (document.getElementById("regionSelector") as HTMLInputElement)!.value = state.region;
    (document.getElementById("selectedRegion") as HTMLSpanElement).textContent = regionMap[state.region];

    new CookiesEuBanner(function () {
      state.appliances = JSON.parse(localStorage.getItem("appliances")!) || state.appliances;
    });

    let gather_futs: Promise<void>[] = [];

    await updateGraphs(true);
    state.nextAvailable = (await getNextAvailable());

    right.disabled = !state.nextAvailable;

    for (let appliance of state.appliances) {
      gather_futs.push(addAppliance(appliance));
    };

    if (state.appliances.length > 7) {
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
      state.region = ((event.target as HTMLInputElement)!).value as Region;
      (document.getElementById("selectedRegion") as HTMLSpanElement).textContent = regionMap[state.region];
      setCookie("region", ((event.target as HTMLInputElement)!).value, 365);

      let gather_futs: Promise<void>[] = [];

      let dt_range = getLondonDayRangeAsDate(0);
      await getData(dt_range.start, dt_range.end, true);
      await updateGraphs();

      for (let appliance of state.appliances) {
        gather_futs.push(updateAppliance(appliance, true));
      };

      await Promise.all(gather_futs);
    });

    const mediaQuery = window.matchMedia("(max-width: 1100px)");
    layoutCallback(mediaQuery);

    mediaQuery.addEventListener("change", layoutCallback);
    (document.getElementById("compare-link")!).classList.add("disabled");
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
      if (state.openModal! && event.target == document.getElementById(state.openModal!)) {
        closeModal();
      }
    }
  });
})()
