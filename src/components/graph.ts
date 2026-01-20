"use strict";

declare const Plotly: any;

import { normalize, getJetColor } from "./utils.ts";
import { BarProfileSettings, GaugeProfileSettings } from "./graph_types.ts";

import type { BarProfile, BarMode, Range, BarProfileSetting, GaugeProfile, GaugeProfileSetting, GaugeId } from "./graph_types.ts";

let curBarProfile: BarProfile = "unitBar";
let curBarMode: BarMode = "tariffBar";

function generateTimes(min_offset: number = 0) {
  let times = [];
  let start = new Date(1970, 0, 1, 0, min_offset, 0, 0);
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
  standingCharge: number,
  altTariffData: number[],
  barMode: BarMode = "tariffBar"
) {
  y.concat(Array(Math.max(48 - y.length, 0)).fill(0));
  curBarMode = barMode;
  let traces: any = [];

  var standingChargeTrace = {
    x: generateTimes(),
    y: (new Array(48).fill(standingCharge)),
    type: 'bar',
    name: "Standing Charge",
    visible: (curBarProfile == "costBar"),
    marker: {
      color: 'purple',          // base fill color
      pattern: {
        fgcolor: 'purple',      // color of the hatch lines
      }
    },
    hovertemplate: 'Standing charge %{y}<extra></extra>'
  }

  traces.push(standingChargeTrace);

  var tariffData = {
    x: generateTimes(),
    y: y,
    type: 'bar',
    name: "Agile Octopus",
    marker: {
      color: y,
      colorscale: 'Jet',
      cmin: colourRange[0],
      cmax: colourRange[1],
    },
    hovertemplate: '%{x|%H:%M} - %{y}<extra></extra>'
  };

  traces.push(tariffData);

  if (curBarMode == "compareBar") {
    let stepLine = {
      type: 'scatter',
      mode: 'lines',
      name: 'Octopus Go',
      visible: (curBarProfile == "unitBar" || curBarProfile == "costBar"),
      x: generateTimes(-15),
      y: altTariffData.concat(Array(Math.max(48 - altTariffData.length, 0)).fill(0)),
      line: {
        shape: 'hv',
        dash: 'dash',
        width: 3,
        color: 'black'
      }
    };
    traces.push(stepLine);
  };

  let layout = {
    dragmode: false,  // Disable zoom/pan
    autosize: true,
    showlegend: (barMode == "compareBar"),
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
    newBar(x, y, titlePrefix, colourRange, dataRange, suffix, standingCharge, altTariffData, barMode);
    return;
  };
  y.concat(Array(Math.max(48 - y.length, 0)).fill(0))

  let traces: any = [];

  var standingChargeArr = {
    y: new Array(48).fill(standingCharge),
  };

  traces.push(standingChargeArr);

  var tariffData = {
    y: y,
    marker: { color: y, cmin: colourRange[0], cmax: colourRange[1] } // update colors
  };

  traces.push(tariffData);

  if (curBarMode == "compareBar") {
    var altTariffArr = {
      y: altTariffData.concat(Array(Math.max(48 - altTariffData.length, 0)).fill(0)),
    };
    traces.push(altTariffArr);
  };

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
      visible: (curBarProfile == "unitBar" || curBarProfile == "costBar")
    }, [2]); // other tariff  };
  };
  console.log((curBarProfile == "unitBar" || curBarProfile == "costBar"));
  Plotly.restyle('graphContainer', {
    visible: (curBarProfile == "unitBar" || curBarProfile == "costBar")
  }, [0]); // standing charge  }
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
