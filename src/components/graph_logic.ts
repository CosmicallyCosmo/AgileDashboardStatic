"use strict";

import { getLondonDayRangeAsDate } from "./utils";
import { state } from "./state";
import { updateBar, updateKPI } from "./graph";
import { generateUnitGraphData, generateConsumptionGraphData, generateCostGraphData } from "./data_methods";

import type { BarMode, BarProfile } from "./graph_types.ts";

let selectedGraph: BarProfile = "unitBar";

const right = (document.getElementById("right") as HTMLInputElement);

export async function updateGraphs(initial = false, direction = "right", barMode: BarMode = "tariffBar") {
  let dt_range = getLondonDayRangeAsDate(state.offset);
  let start = dt_range.start;
  let end = dt_range.end;

  if (selectedGraph === "unitBar") {
    var gb = await generateUnitGraphData(start, end, initial, direction, barMode);
  } else if (selectedGraph === "consumptionBar") {
    var gb = await generateConsumptionGraphData(start, end);
  } else {
    var gb = await generateCostGraphData(start, end, initial, direction, barMode);
  };
  updateBar(gb.times, gb.data, selectedGraph, initial, Math.round(gb.standingCharge * 100 + Number.EPSILON) / 4800, gb.altTariffData, barMode);
  updateKPI("start-kpi", ...gb.startKPI, initial);
  updateKPI("middle-kpi", ...gb.middleKPI, initial);
  updateKPI("end-kpi", ...gb.endKPI, initial);
  if (initial)
    document.getElementById("graphContainer")!.classList.add("show");
};

export async function selectGraph(selected: BarProfile = "unitBar", barMode: BarMode = "tariffBar") {
  let unitButtonClassList = (document.getElementById("selectUnit") as HTMLButtonElement)!.classList;
  let consumptionClassList = (document.getElementById("selectConsumption") as HTMLButtonElement)!.classList;
  let costClassList = (document.getElementById("selectCost") as HTMLButtonElement)!.classList;
  selectedGraph = selected;
  if (selectedGraph === "unitBar") {
    const disabled = (state.offset == 1 || (state.offset == 0 && !state.nextAvailable));
    right.disabled = disabled;
    unitButtonClassList.add("noHover", "unSelectedGraphType");
    consumptionClassList.remove("noHover", "unSelectedGraphType");
    costClassList.remove("noHover", "unSelectedGraphType");
  } else if (selectedGraph === "consumptionBar") {
    const disabled = (state.offset >= 0);
    right.disabled = disabled;
    unitButtonClassList.remove("noHover", "unSelectedGraphType");
    consumptionClassList.add("noHover", "unSelectedGraphType");
    costClassList.remove("noHover", "unSelectedGraphType");
  } else {
    unitButtonClassList.remove("noHover", "unSelectedGraphType");
    consumptionClassList.remove("noHover", "unSelectedGraphType");
    costClassList.add("noHover", "unSelectedGraphType");
    const disabled = (state.offset >= 0);
    right.disabled = disabled;
  }
  await updateGraphs(undefined, undefined, barMode);
};
