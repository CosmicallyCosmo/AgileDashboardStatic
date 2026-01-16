"use strict";

export const regions = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P"] as const;

export const regionMap: Record<string, string> = {
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

export type RegionRow = {
  valid_from: Date;
  valid_to: Date;
  value_inc_vat: number;
};

export type ConsumptionRow = {
  interval_start: Date;
  interval_end: Date;
  consumption: number;
};

export type Region = typeof regions[number];

