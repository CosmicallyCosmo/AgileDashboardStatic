"use strict";

// @ts-ignore
import * as Plotly from '../packages/plotly-custom.min.js';

import { normalize, getJetColor } from "./utils.js";

export function updatebar(x: string[], y: number[], suffix = "p", min = -20, max = 50) {
    var data = {
            x: x,
            y: y,
            type: 'bar',
            marker: {
                color: y,  // values to determine colors
                colorscale: 'Jet',            // Jet color scale
                cmin: min,                    // min value for the color scale
                cmax: max,                      // max value for the color scale
            },
            hovertemplate: '%{x|%H:%M} - %{y}<extra></extra>' 
        };
    
    let layout = {
        autosize: true,
        xaxis: {fixedrange: true, tickformat: '%H:%M'},
        yaxis: {fixedrange: true, showgrid: false, linecolor: 'lightgray', linewidth: 1, showticklabels: true, ticksuffix: suffix},
        paper_bgcolor: "rgba(0,0,0,0)",  // Transparent background
        plot_bgcolor: "rgba(0,0,0,0)",
        font: {
            family: 'Quicksand', // change this to your desired font
            size: 10,
            color: '#333'
        },
        title: {
            text: new Date(x[0]).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'}),
            font: { size: 20 }
          },
        margin: {
                l: 40,  // Left margin
                r: 10,  // Right margin
                t: 80,  // Top margin (reduce for tighter title spacing)
                b: 40   // Bottom margin
        },
    };

    var config = {
        responsive: true,
        autosize: true,
        showlegend: false,
        clickmode: 'none',
        dragmode: false,  // Disable zoom/pan
        displayModeBar: false,  // Disable the modebar (zoom, reset, etc.)
        showTips: false,
    };

    // @ts-ignore
    Plotly.react('graphContainer', data, layout, config);
}

export function updatekpi(id: string, avg: number, mavg: number, label: string, suffix = "p") {

    const minValue = -20;
    const maxValue = 50;
    const normalizedValue = normalize(avg, minValue, maxValue);
    const color = getJetColor(normalizedValue); // Returns color in rgba format

    var data = {
          domain: { x: [0, 1], y: [0, 1] },
          value: avg,
          title: { text: label, font: {size: 15}},
          type: "indicator",
          mode: "gauge+number",
          delta: { reference: mavg},
          number: {suffix: suffix},
          gauge: { axis: { range: [-10, 100] },  bar: { color: color }}
        }

    var layout = {
        margin: { l: 20, r: 45, t: 50, b: 20},
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
    Plotly.react(id, data, layout, config);
}