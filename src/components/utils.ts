"use strict";

import { Temporal } from '@js-temporal/polyfill';
import * as d3 from "d3";
declare const CookiesEuBanner: any;

export interface TimeFormat {
  hours: number,
  minutes: number,
}

var entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

export function escapeHtml(str: string) {
  return String(str).replace(/[&<>"'`=\/]/g, function (s: string) {
    // @ts-ignore
    return entityMap[s];
  });
}

export function validateInt(str: string, min: number, max: number) {
  const parsed_int = parseInt(str);
  if (min <= parsed_int && parsed_int <= max) {
    return parsed_int;
  }
  return -1;
};

export function normalize(value: number, min: number, max: number) {
  return (value - min) / (max - min);
}

export function getJetColor(value: number) {
  const normValue = Math.max(0, Math.min(1, value)); // Ensure it's clamped between 0 and 1
  var colorScale = d3.scaleSequential(d3.interpolateTurbo);
  return colorScale(normValue);
}

export function setCookie(cname: any, cvalue: any, exdays: number) {
  new CookiesEuBanner(function () {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires=" + d.toUTCString();
    document.cookie = `${cname}=${cvalue};${expires};path=/`;
  })
}

export function getCookie(cname: any, def: any) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return def;
}

export function minMovingAverage(unit: number[], intervals: number) {
  // if (n > prices.length) return null; // not enough data

  // Sum of first block
  let currentSum = 0;
  for (let i = 0; i < intervals; i++) {
    currentSum += unit[i];
  }

  let minSum = currentSum;
  let minIndex = 0;

  // Slide the window
  for (let i = intervals; i < unit.length; i++) {
    currentSum = currentSum - unit[i - intervals] + unit[i];
    if (currentSum < minSum) {
      minSum = currentSum;
      minIndex = i - intervals + 1;
    }
  }

  return {
    startIndex: minIndex,
    sum: minSum,
  };
};

export function toLondonISOString(utcDate: Date) {
  // Convert to a Date in London time and output ISO string (still works in Plotly)
  return new Date(
    utcDate.toLocaleString("en-US", { timeZone: "Europe/London" })
  );
};

export function getLondonDayRangeAsDate(offset = 0) {
  const londonZone = 'Europe/London';

  // Get today in London
  let londonDate = Temporal.Now.plainDateISO(londonZone);

  // Apply offset
  londonDate = londonDate.add({ days: offset });

  // Start of day in London
  const startZoned = londonDate.toPlainDateTime({ hour: 0, minute: 0, second: 0 })
    .toZonedDateTime(londonZone);

  // End of day in London (exclusive)
  const endZoned = londonDate.add({ days: 1 }).toPlainDateTime({ hour: 0, minute: 0, second: 0 })
    .toZonedDateTime(londonZone);

  const start = new Date(startZoned.toInstant().epochMilliseconds);
  const end = new Date(endZoned.toInstant().epochMilliseconds);

  return { start, end };
}
