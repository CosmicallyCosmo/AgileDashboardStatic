"use strict";

declare const Plotly: any;

import { normalize, getJetColor } from "./utils.ts";

type Range = [number, number];
type GaugeId = "start-kpi" | "middle-kpi" | "end-kpi";
export type GaugeProfile = "powerGauge" | "consumptionGauge" | "unitGauge" | "costGauge" | "totalCostGauge";
export type BarProfile = "unitBar" | "consumptionBar" | "costBar";
export type BarMode = "tariffBar" | "compareBar"
type BarProfileSetting = { titlePrefix: string, colourRange: Range, dataRange: Range, suffix: string };
type BarProfileTraces = { unitBar: boolean, standingBar: boolean, tariffTrace: boolean };
type GaugeProfileSetting = { colourRange: Range, dataRange: Range, suffix: string, prefix: string };

const GaugeProfileSettings: Record<GaugeProfile, GaugeProfileSetting> = {
  unitGauge: { colourRange: [-20, 50], dataRange: [-5, 40], suffix: "p", prefix: "" },
  powerGauge: { colourRange: [-500, 3500], dataRange: [0, 3000], suffix: "W", prefix: "" },
  consumptionGauge: { colourRange: [-10, 40], dataRange: [0, 50], suffix: "kWh", prefix: "" },
  costGauge: { colourRange: [-20, 40], dataRange: [-20, 60], suffix: "p", prefix: "" },
  totalCostGauge: { colourRange: [-20, 700], dataRange: [-20, 600], suffix: "", prefix: "£" }
};

const BarProfileSettings: Record<BarProfile, BarProfileSetting> = {
  unitBar: { titlePrefix: "Tariff data for ", colourRange: [-20, 50], dataRange: [-5, 40], suffix: "p" },
  consumptionBar: { titlePrefix: "Consumption for ", colourRange: [-2, 2], dataRange: [0, 2], suffix: "kWh" },
  costBar: { titlePrefix: "Cost for ", colourRange: [-10, 40], dataRange: [-10, 40], suffix: "p" },
};

const BarProfileTraces: Record<BarMode, BarProfileTraces> = {
  tariffBar: { unitBar: true, standingBar: true, tariffTrace: false },
  compareBar: { unitBar: true, standingBar: true, tariffTrace: true },
};

let curBarProfile: BarProfile = "unitBar";
let curBarMode: BarMode = "tariffBar";

function generateTimes() {
  let times = [];
  let start = new Date(1970, 0, 1, 0, 0, 0, 0);
  for (let i = 0; i < 48; i++) {
    const time = new Date(start.getTime() + i * 30 * 60 * 1000);
    times.push(time);
  }
  return times;
}

export function newBar(
  x: Date[],
  y: number[],
  titlePrefix: string,
  colourRange: Range,
  dataRange: Range,
  suffix: string,
  barMode: BarMode = "tariffBar"
) {
  y.concat(Array(Math.max(48 - y.length, 0)).fill(0));

  curBarMode = barMode;
  let traces: any = [];

  if (curBarMode == "compareBar") {
    let stepLine = {
      type: 'scatter',
      mode: 'lines',
      name: 'Threshold',
      visible: false,
      x: generateTimes(),
      y: new Array(48).fill(0),
      line: {
        shape: 'hv',
        dash: 'dash',
        width: 2,
        color: 'purple'
      }
    };
    traces.push(stepLine);
  };

  var standingCharge = {
    x: generateTimes(),
    y: (new Array(48).fill(0)),
    type: 'bar',
    marker: {
      color: 'purple',          // base fill color
      pattern: {
        fgcolor: 'purple',      // color of the hatch lines
      }
    },
    hovertemplate: 'Standing charge %{y}<extra></extra>'
  }

  traces.push(standingCharge);

  var tariffData = {
    x: generateTimes(),
    y: y,
    type: 'bar',
    marker: {
      color: y,
      colorscale: 'Jet',
      cmin: colourRange[0],
      cmax: colourRange[1],
    },
    hovertemplate: '%{x|%H:%M} - %{y}<extra></extra>'
  };

  traces.push(tariffData);

  let layout = {
    dragmode: false,  // Disable zoom/pan
    autosize: true,
    showlegend: false,
    xaxis: { tickformat: '%H:%M' },
    yaxis: { range: dataRange, showgrid: false, linecolor: 'lightgray', linewidth: 1, showticklabels: true, ticksuffix: suffix },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    barmode: "stack",
    font: {
      family: 'Quicksand',
      size: 10,
      color: '#333'
    },
    title: {
      text: titlePrefix + new Date(x[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      font: { size: 20 }
    },
    margin: {
      l: 40,
      r: 5,
      t: 80,
      b: 15,
    },
  };

  var config = {
    responsive: true,
    autosize: true,
    clickmode: 'none',
    visible: 'none',
    displayModeBar: false,  // Disable the modebar (zoom, reset, etc.)
    showTips: false,
  };

  Plotly.newPlot('graphContainer', traces, layout, config);
};

export function updateBar(
  x: Date[],
  y: number[],
  type: BarProfile,
  initial = false,
  standingCharge = 0,
  altTariffData: number[] = [],
  barMode: BarMode = "tariffBar") {

  const { titlePrefix, colourRange, dataRange, suffix }: BarProfileSetting = BarProfileSettings[type];
  if (initial) {
    newBar(x, y, titlePrefix, colourRange, dataRange, suffix, barMode);
    return;
  };
  y.concat(Array(Math.max(48 - y.length, 0)).fill(0))

  let traces: any = [];

  if (curBarMode == "compareBar") {
    var altTariffArr = {
      y: altTariffData.concat(Array(Math.max(48 - altTariffData.length, 0)).fill(0)),
    };
    traces.push(altTariffArr);
  };

  var standingChargeArr = {
    y: new Array(48).fill(standingCharge),
  };

  traces.push(standingChargeArr);

  var tariffData = {
    y: y,
    marker: { color: y, cmin: colourRange[0], cmax: colourRange[1] } // update colors
  };

  traces.push(tariffData);

  let animationTime = 150;
  if (curBarProfile != type) {
    animationTime = 0;
    curBarProfile = type;
  }

  // Animate the update
  Plotly.animate('graphContainer', {
    data: traces,      // new trace data
    layout: {
      yaxis: {
        range: dataRange
      }
    }
  }, {
    transition: {
      duration: animationTime,   // duration of animation in ms
      easing: 'cubic-in-out'
    },
    frame: { duration: animationTime, redraw: true },
  });

  // Update layout if needed (e.g., title or y-axis)
  Plotly.relayout('graphContainer', {
    'yaxis.ticksuffix': suffix,
    'title.text': titlePrefix + x.at(-1)!.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  });

  if (curBarMode == "compareBar") {
    Plotly.restyle('graphContainer', {
      visible: (curBarProfile == "unitBar")
    }, [0]); // other tariff  }
  };
};

export function newKPI(
  id: GaugeId,
  title: string,
  value: number,
  colourRange: Range,
  dataRange: Range | string,
  suffix: string,
): void {
  const normalizedValue = normalize(value, colourRange[0], colourRange[1]);
  const colour = getJetColor(normalizedValue);

  var data = [{
    domain: { x: [0, 1], y: [0, 1] },
    value: value,
    type: "indicator",
    mode: "gauge+number",
    number: { suffix: suffix, valueformat: ".2f" },
    gauge: { axis: { range: dataRange }, bar: { color: colour } }
  }];

  var layout = {
    title: { text: title, font: { size: 18 } },
    margin: { l: 20, r: 45, t: 50, b: 20 },
    paper_bgcolor: "rgba(0,0,0,0)",  // Transparent background
    plot_bgcolor: "rgba(0,0,0,0)",
    font: {
      family: 'Quicksand', // change this to your desired font
      color: '#333'
    },
  };

  var config = {
    responsive: true,
    autosize: true,
    staticPlot: true,
  };

  // @ts-ignore
  Plotly.newPlot(id, data, layout, config);
};


export function updateKPI(
  id: GaugeId,
  title: string,
  value: number,
  type: GaugeProfile = "unitGauge",
  initial = false,
): void {

  const { colourRange, dataRange, suffix, prefix }: GaugeProfileSetting = GaugeProfileSettings[type];

  if (initial) {
    newKPI(id, title, value, colourRange, dataRange, suffix);
    return;
  };

  const normalizedValue = normalize(value, colourRange[0], colourRange[1]);
  const colour = getJetColor(normalizedValue);
  Plotly.animate(id, {
    data: [{
      value: value,
      gauge: { axis: { range: dataRange }, bar: { color: colour } },
      number: { suffix: suffix, prefix: prefix },
    }]
  }, {
    transition: {
      duration: 150, // speed of animation in ms
      easing: 'cubic-in-out'
    },
    frame: { duration: 150, redraw: true }
  });

  Plotly.relayout(id, { 'title.text': title });
}
