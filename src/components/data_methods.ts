"use strict";

declare const CookiesEuBanner: any;

import { db } from "./db.ts";
import { state } from "./state.ts";

import { getUnitData, getGoData, getStandingCharge } from "./api_methods.ts";
import { generateTimes } from "./utils.ts";

export async function getNextAvailable() {
  let tomorrow = new Date();
  let region = state.region;
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0);
  let last_date = new Date((await db[region].orderBy("valid_from").last())!.valid_from);
  return (last_date.getTime() > tomorrow.getTime());
};

export async function getData(pf: Date, pt: Date, initial = false, direction = "right") {
  const t = new Date();
  let max = 30;
  if (initial)
    max = 3;
  let res = await db[state.region].where("valid_from").between(pf, pt, true, false).toArray();
  if (initial || (res.length !== 48 && !((pf.toDateString() == t.toDateString()) && res.length >= 40) && !((pf.getTime() > t.getTime()) && t.getHours() >= 16))) {
    let npf = new Date(pf.valueOf());
    let npt = new Date(pt.valueOf());
    if (direction === "left") {
      npf.setDate(npf.getDate() - max);
    } else {
      npt.setDate(npt.getDate() + max);
    };
    res = (await getUnitData(state.region, npf, npt)).results;
    const convertedData = res.map(item => ({
      ...item,
      valid_from: new Date(item.valid_from),
      valid_to: new Date(item.valid_to)
    }));
    res = await db[state.region].bulkPut(convertedData).then(() => {
      return db[state.region].where("valid_from").between(pf, pt, true, false).toArray();
    });
  };
  return res;
};

export async function getGo(pf: Date, pt: Date) {
  let res = await getGoData(pf, pt);
  res = generateTimes(pf, pt, res.results);
  return res;
}

export async function getStandingChargeData(pf: Date, pt: Date) {
  // This is stupid, will break on overlaps
  let shouldUpdate = true;
  let standingCharge = JSON.parse(localStorage.getItem("standingCharge")!);

  if (standingCharge) {
    let valid_from = new Date(standingCharge.valid_from);
    if (standingCharge.region == state.region && valid_from.getTime() < pf.getTime()) {
      shouldUpdate = false;
    };
  };

  if (shouldUpdate) {
    let res = await getStandingCharge(state.region, pf, pt);
    if (res === false) {
      // panic
    };
    standingCharge = { region: state.region, cost: res.results[0].value_inc_vat, valid_from: new Date(res.results[0].valid_from) };
    new CookiesEuBanner(function () {
      localStorage.setItem("standingCharge", JSON.stringify(standingCharge));
    });
  };
  return standingCharge.cost;
}
