"use strict";

declare const Plotly: any;

import { normalize, getJetColor } from "./utils.ts";

type Range = [number, number];
type GaugeId = "start-kpi" | "middle-kpi" | "end-kpi";
export type GaugeProfile = "powerGauge" | "consumptionGauge" | "unitGauge";
export type BarProfile = "unitBar" | "consumptionBar";
type BarProfileSetting = { titlePrefix: string, colourRange: Range, dataRange: Range, suffix: string };
type GaugeProfileSetting = { colourRange: Range, dataRange: Range, suffix: string };

const GaugeProfileSettings: Record<GaugeProfile, GaugeProfileSetting> = {
  unitGauge: { colourRange: [-20, 50], dataRange: [-5, 40], suffix: "p" },
  powerGauge: { colourRange: [-500, 3500], dataRange: [0, 3000], suffix: "W" },
  consumptionGauge: { colourRange: [-10, 40], dataRange: [0, 50], suffix: "kWh" },
}

const BarProfileSettings: Record<BarProfile, BarProfileSetting> = {
  unitBar: { titlePrefix: "Tariff data for ", colourRange: [-20, 50], dataRange: [-5, 40], suffix: "p" },
  consumptionBar: { titlePrefix: "Consumption data for ", colourRange: [-2, 2], dataRange: [0, 2], suffix: "kWh" },
};

function generateTimes() {
  let times = [];
  let start = new Date(1970, 0, 1, 0, 0, 0, 0);
  for (let i = 0; i < 48; i++) {
    const time = new Date(start.getTime() + i * 30 * 60 * 1000);
    times.push(time);
  }
  return times;
}

export function newBar(x: Date[], y: number[], titlePrefix: string, colourRange: Range, dataRange: Range, suffix: string) {
  // TODO: pad out the values so the new day has 48 then normalize etc
  y = Object.assign(new Array(48), y);
  var data = [{
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
  }];

  let layout = {
    dragmode: false,  // Disable zoom/pan
    autosize: true,
    xaxis: { tickformat: '%H:%M' },
    yaxis: { range: dataRange, showgrid: false, linecolor: 'lightgray', linewidth: 1, showticklabels: true, ticksuffix: suffix },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
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
    showlegend: false,
    clickmode: 'none',
    displayModeBar: false,  // Disable the modebar (zoom, reset, etc.)
    showTips: false,
  };

  Plotly.newPlot('graphContainer', data, layout, config);
};

export function updateBar(x: Date[], y: number[], type: BarProfile, initial = false) {
  const {titlePrefix, colourRange, dataRange, suffix }: BarProfileSetting = BarProfileSettings[type];
  if (initial) {
    newBar(x, y, titlePrefix, colourRange, dataRange, suffix);
    return;
  };
  y = Object.assign(new Array(48), y);
  // Prepare new data
  var newData = {
    y: y,
    marker: { color: y, cmin: colourRange[0], cmax: colourRange[1] } // update colors
  };

  // Animate the update
  Plotly.animate('graphContainer', {
    data: [newData]      // new trace data
  }, {
    transition: {
      duration: 500,   // duration of animation in ms
      easing: 'cubic-in-out'
    },
    frame: { duration: 500, redraw: true }
  });
  // Update layout if needed (e.g., title or y-axis)
  Plotly.relayout('graphContainer', {
    'yaxis.range': dataRange,
    'yaxis.ticksuffix': suffix,
    'title.text': titlePrefix + x.at(-1)!.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  });
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
    number: { suffix: suffix },
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
}

export function updateKPI(
  id: GaugeId,
  title: string,
  value: number,
  type: GaugeProfile = "unitGauge",
  initial = false,
): void {

  const { colourRange, dataRange, suffix }: GaugeProfileSetting = GaugeProfileSettings[type];

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
      number: { suffix: suffix },
    }]
  }, {
    transition: {
      duration: 500, // speed of animation in ms
      easing: 'cubic-in-out'
    },
    frame: { duration: 500, redraw: true }
  });

  Plotly.relayout(id, { 'title.text': title });
}
