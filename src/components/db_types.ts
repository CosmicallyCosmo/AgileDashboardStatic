"use strict";

export const tariffCodes = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Go"] as const;
export type TariffCode = typeof tariffCodes[number];

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

export interface Tariff {
  tariff: TariffCode;
  valid_from: Date;
  valid_to: Date;
  value_inc_vat: number;
}

export interface Consumption {
  valid_from: Date;
  valid_to: Date;
  consumption: number;
}

export interface Standing {
  tariff: TariffCode;
  valid_from: Date;
  valid_to: Date;
  value_inc_vat: number;
}


