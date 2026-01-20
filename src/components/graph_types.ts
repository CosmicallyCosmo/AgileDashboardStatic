"use strict";

export type Range = [number, number];
export type GaugeId = "start-kpi" | "middle-kpi" | "end-kpi";
export type GaugeProfile = "powerGauge" | "consumptionGauge" | "unitGauge" | "costGauge" | "totalCostGauge";
export type BarProfile = "unitBar" | "consumptionBar" | "costBar";
export type BarMode = "tariffBar" | "compareBar"
export type BarProfileSetting = { titlePrefix: string, colourRange: Range, dataRange: Range, suffix: string };
export type BarProfileTraces = { unitBar: boolean, standingBar: boolean, tariffTrace: boolean };
export type GaugeProfileSetting = { colourRange: Range, dataRange: Range, suffix: string, prefix: string };
export type GaugeData = [string, number, GaugeProfile];

export type GraphBundle = {
  standingCharge: number,
  altTariffData: number[],
  data: number[],
  times: Date[],
  startKPI: GaugeData,
  middleKPI: GaugeData,
  endKPI: GaugeData,
}

export const GaugeProfileSettings: Record<GaugeProfile, GaugeProfileSetting> = {
  unitGauge: { colourRange: [-20, 50], dataRange: [-5, 40], suffix: "p", prefix: "" },
  powerGauge: { colourRange: [-500, 3500], dataRange: [0, 3000], suffix: "W", prefix: "" },
  consumptionGauge: { colourRange: [-10, 40], dataRange: [0, 50], suffix: "kWh", prefix: "" },
  costGauge: { colourRange: [-20, 40], dataRange: [-20, 60], suffix: "p", prefix: "" },
  totalCostGauge: { colourRange: [-2, 20], dataRange: [-2, 15], suffix: "", prefix: "£" }
};

export const BarProfileSettings: Record<BarProfile, BarProfileSetting> = {
  unitBar: { titlePrefix: "Tariff data for ", colourRange: [-20, 50], dataRange: [-5, 80], suffix: "p" },
  consumptionBar: { titlePrefix: "Consumption for ", colourRange: [-2, 2], dataRange: [0, 2], suffix: "kWh" },
  costBar: { titlePrefix: "Cost for ", colourRange: [-10, 40], dataRange: [-10, 80], suffix: "p" },
};

export const BarProfileTraces: Record<BarMode, BarProfileTraces> = {
  tariffBar: { unitBar: true, standingBar: true, tariffTrace: false },
  compareBar: { unitBar: true, standingBar: true, tariffTrace: true },
};
