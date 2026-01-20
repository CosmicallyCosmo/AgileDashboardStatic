"use strict";

import { db } from "./db.ts";
import { state } from "./state.ts";

import { getUnitData, getConsumptionData, getGoData, getStandingCharge } from "./api_methods.ts";
import { generateTimes, calculateConsumptionCost } from "./utils.ts";
import { openModal } from "./modal_logic.ts";

import type { BarMode, GaugeData, GraphBundle } from "./graph_types.ts";
import type { Tariff, Standing, TariffCode } from "./db_types.ts";

export async function getNextAvailable() {
  let tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0);
  let last_date = new Date((await db.tariff.where('tariff').equals(state.region).last())!.valid_from);
  return (last_date.getTime() > tomorrow.getTime());
};

export async function getData(pf: Date, pt: Date, initial = false, direction = "right") {
  const t = new Date();
  let max = 30;
  if (initial)
    max = 3;
  let res = await db.tariff.where("[tariff+valid_from]").between([state.region, pf], [state.region, pt], true, false).toArray();
  if (initial || (res.length !== 48 && !((pf.toDateString() == t.toDateString()) && res.length >= 40) && !((pf.getTime() > t.getTime()) && t.getHours() >= 16))) {
    let npf = new Date(pf.valueOf());
    let npt = new Date(pt.valueOf());
    if (direction === "left") {
      npf.setDate(npf.getDate() - max);
    } else {
      npt.setDate(npt.getDate() + max);
    };
    res = (await getUnitData(state.region, npf, npt)).results;
    const convertedData: Tariff[] = res.map(item => ({
      tariff: state.region,
      valid_from: new Date(item.valid_from),
      valid_to: new Date(item.valid_to),
      value_inc_vat: item.value_inc_vat,
    }));
    res = await db.tariff.bulkPut(convertedData).then(() => {
      return db.tariff.where("[tariff+valid_from]").between([state.region, pf], [state.region, pt], true, false).toArray();
    });
  };
  return res;
};

export async function getUserData(pf: Date, pt: Date) {
  // Would be better to have nice overlay on days with no data
  let now = new Date();
  let errorMessageContainer = document.getElementById("noDataWarningMessage") as HTMLParagraphElement;
  if (pf > now) {
    errorMessageContainer.innerText = "No usage data for this day yet!";
    openModal("noDataWarning");
    return generateTimes(pf, pt, [{ valid_from: pf, valid_to: pt, value_inc_vat: 0 }]);
  };
  let res = await db.consumption.where("valid_from").between(pf, pt, true, false).toArray();
  if (res.length != 48) {
    let new_pf = new Date(pf.valueOf());
    if (pf.toDateString() !== now.toDateString())
      new_pf.setDate(pt.getDate() - 30);
    let consData: any[] = (await getConsumptionData(new_pf, pt)).results;
    const convertedData = consData.map(item => ({
      valid_from: new Date(item.interval_start),
      valid_to: new Date(item.interval_end),
      consumption: item.consumption,
    }));
    res = await db.consumption.bulkPut(convertedData).then(() => {
      return db.consumption.where("valid_from").between(pf, pt, true, false).toArray();
    });
  }
  if (res.length != 48) {
    // make this work on a partial result
    errorMessageContainer.innerText = "No usage data for this day yet!";
    openModal("noDataWarning");
    return generateTimes(pf, pt, [{ valid_from: pf, valid_to: pt, value_inc_vat: 0 }]);
  }
  return res;
}

export async function getGo(pf: Date, pt: Date, initial = false, direction = "right") {
  const t = new Date();
  let max = 30;
  if (initial)
    max = 3;
  let res = await db.tariff.where("[tariff+valid_from]").between(["Go", pf], ["Go", pt], true, false).toArray();
  if (initial || (res.length !== 48 && !((pf.toDateString() == t.toDateString()) && res.length >= 40) && !((pf.getTime() > t.getTime()) && t.getHours() >= 16))) {
    let npf = new Date(pf.valueOf());
    let npt = new Date(pt.valueOf());
    if (direction === "left") {
      npf.setDate(npf.getDate() - max);
    } else {
      npt.setDate(npt.getDate() + max);
    };
    res = (await getGoData(npf, npt)).results;
    let expandedRes = generateTimes(npf, npt, res);
    const convertedData: Tariff[] = expandedRes.map(item => ({
      tariff: "Go",
      valid_from: new Date(item.valid_from),
      valid_to: new Date(item.valid_to),
      value_inc_vat: item.value_inc_vat,
    }));
    res = await db.tariff.bulkPut(convertedData).then(() => {
      return db.tariff.where("[tariff+valid_from]").between(["Go", pf], ["Go", pt], true, false).toArray();
    });
  };
  return res;
};

export async function getStandingChargeData(pf: Date, pt: Date, tariffCode: TariffCode | null = null) {
  // This is stupid, will break on overlaps
  tariffCode = tariffCode || state.region;
  let res = await db.standing.where("[tariff+valid_from]").between([tariffCode, pf], [tariffCode, pt], true, false).toArray();
  if (res.length == 0) {
    res = (await getStandingCharge(tariffCode, pf, pt)).results;
    let expandedRes = generateTimes(null, pt, res, "daily");
    const convertedData: Standing[] = expandedRes.map(item => ({
      tariff: tariffCode,
      valid_from: new Date(item.valid_from),
      valid_to: new Date(item.valid_to),
      value_inc_vat: item.value_inc_vat,
    }));
    res = await db.standing.bulkPut(convertedData).then(() => {
      return db.standing.where("[tariff+valid_from]").between([tariffCode, pf], [tariffCode, pt], true, false).toArray();
    });
  };
  return res[0].value_inc_vat;
}

export async function generateUnitGraphData(start: Date, end: Date, initial: boolean, direction: string, barMode: BarMode): Promise<GraphBundle> {
  let res: any[] = await getData(start, end, initial, direction);
  var data = res.map(a => a.value_inc_vat);
  if (barMode == "compareBar") {
    let goRes = await getGo(start, end, initial, direction);
    var goData = goRes.map(a => a.value_inc_vat);
  } else {
    goData = (new Array(48).fill(0));
  };
  let startTimes = res.map(a => new Date(a.valid_from));
  let startValue: GaugeData = ["Min price", Math.round(Math.min(...data) * 100 + Number.EPSILON) / 100 as number, "unitGauge"];
  let middleValue: GaugeData = ["Avg price", (Math.round((data.reduce((partialSum, a) => partialSum + a, 0) / data.length) * 100 + Number.EPSILON) / 100) as number, "unitGauge"];
  let endValue: GaugeData = ["Max price", Math.round(Math.max(...data) * 100 + Number.EPSILON) / 100 as number, "unitGauge"];
  return { standingCharge: 0, altTariffData: goData, data: data, times: startTimes, startKPI: startValue, middleKPI: middleValue, endKPI: endValue };
};

export async function generateConsumptionGraphData(start: Date, end: Date): Promise<GraphBundle> {
  let res: any[] = await getUserData(start, end);
  let data = res.map(a => a.consumption);
  let goData = (new Array(48).fill(0))
  let startTimes = res.map(a => new Date(a.valid_from));
  let startValue: GaugeData = ["Total consumption", data.reduce((partialSum, a) => partialSum + a, 0) as number, "consumptionGauge"];
  let middleValue: GaugeData = ["Avg consumption", Math.round((data.reduce((partialSum, a) => partialSum + a, 0) / data.length) * 1000 + Number.EPSILON) as number, "powerGauge"];
  let endValue: GaugeData = ["Max consumption", Math.round(Math.max(...data) * 1000 * 2 + Number.EPSILON) as number, "powerGauge"];
  return { standingCharge: 0, altTariffData: goData, data: data, times: startTimes, startKPI: startValue, middleKPI: middleValue, endKPI: endValue };
};

export async function generateCostGraphData(start: Date, end: Date, initial: boolean, direction: string, barMode: BarMode): Promise<GraphBundle> {
  let res: any[] = await getUserData(start, end);
  var consumptionData = res.map(a => a.consumption);
  var startTimes = res.map(a => new Date(a.valid_from));
  res = await getData(start, end, initial, direction);
  if (barMode == "compareBar") {
    let goRes = await getGo(start, end, initial, direction);
    let goUnitData = goRes.map(a => a.value_inc_vat);
    var goData = calculateConsumptionCost(consumptionData, goUnitData);
    let goStandingCharge: number = await getStandingChargeData(start, end, "Go");
    goData = goData.map((i) => i + (goStandingCharge / 48));
  } else {
    goData = (new Array(48).fill(0));
  };
  var unitData = res.map(a => a.value_inc_vat);
  let standingCharge = await getStandingChargeData(start, end);
  var data: any[] = calculateConsumptionCost(consumptionData, unitData);
  var totalCost = data.reduce((partialSum, a) => partialSum + a, 0) + standingCharge as number;
  var startValue: GaugeData = ["Total day cost", totalCost / 100, "totalCostGauge"];
  var middleValue: GaugeData = ["Min hourly cost", Math.round(Math.min(...data) + Number.EPSILON) as number, "costGauge"];
  var endValue: GaugeData = ["Max hourly cost", Math.round(Math.max(...data) + Number.EPSILON) as number, "costGauge"];
  return { standingCharge: standingCharge, altTariffData: goData, data: data, times: startTimes, startKPI: startValue, middleKPI: middleValue, endKPI: endValue };
};
