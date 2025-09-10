"use strict";

declare const Plotly: any;

import { normalize, getJetColor } from "./utils.ts";

function generateTimes() {
    let times = [];
    let start = new Date(1970, 0, 1, 0, 0, 0, 0);
    for (let i = 0; i < 48; i++) {
        const time = new Date(start.getTime() + i * 30 * 60 * 1000);
        times.push(time);
      }
    return times;
}

export function newBar(x: Date[], y: number[], suffix = "p", min = -20, max = 50) {
    // TODO: pad out the values so the new day has 48 then normalize etc
    y = Object.assign(new Array(48), y);
    var data = [{
            x: generateTimes(),
            y: y,
            type: 'bar',
            marker: {
                color: y,  // values to determine colors
                colorscale: 'Jet',            // Jet color scale
                cmin: min,                    // min value for the color scale
                cmax: max,                      // max value for the color scale
            },
            hovertemplate: '%{x|%H:%M} - %{y}<extra></extra>' 
        }];
    
    let layout = {
        autosize: true,
        xaxis: {tickformat: '%H:%M'},
        yaxis: {range: [-5, 40], showgrid: false, linecolor: 'lightgray', linewidth: 1, showticklabels: true, ticksuffix: suffix},
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
                l: 25,  // Left margin
                r: 5,  // Right margin
                t: 80,  // Top margin (reduce for tighter title spacing)
                b: 15   // Bottom margin
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
    Plotly.newPlot('graphContainer', data, layout, config);
};

export function updateBar(x: Date[], y: number[], suffix = "p", min = -20, max = 50, initial = false, range = [-5, 40]) {
    if (initial) {
        newBar(x, y, suffix, min, max);
        return;
    };
    y = Object.assign(new Array(48), y);
    // Prepare new data
    var newData = {
        y: y,
        marker: { color: y, cmin: min, cmax: max } // update colors
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
        'yaxis.range': range,
        transition: { duration: 500, easing: 'cubic-in-out' },
        'yaxis.ticksuffix': suffix,
        'title.text': new Date(x[0]).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'}),
    });
};

export function newKPI (id: string, avg: number, mavg: number, label: string, suffix = "p", range = [-10, 100]) {
    const minValue = -20;
    const maxValue = 50;
    const normalizedValue = normalize(avg, minValue, maxValue);
    const color = getJetColor(normalizedValue); // Returns color in rgba format

    var data = [{
          domain: { x: [0, 1], y: [0, 1] },
          value: avg,
          type: "indicator",
          mode: "gauge+number",
          delta: { reference: mavg},
          number: {suffix: suffix},
          gauge: { axis: { range: range },  bar: { color: color }}
        }];

    var layout = {
        title: { text: label, font: {size: 18}},
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
    Plotly.newPlot(id, data, layout, config);
}

export function updateKPI(id: string, avg: number, mavg: number, label: string, suffix = "p", initial = false, range = [-10, 100]) {
    if (initial) {
        newKPI(id, avg, mavg, label, suffix);
        return;
    };
    const minValue = -20;
    const maxValue = 50;
    const normalizedValue = normalize(avg, minValue, maxValue);
    const color = getJetColor(normalizedValue); // Returns color in rgba format
    // Animate the gauge value and color
    Plotly.animate(id, {
        data: [{
            value: avg,
            gauge: { axis: {range: range}, bar: { color: color } },
            delta: { reference: mavg },
            number: { suffix: suffix },
        }]
    }, {
        transition: {
            duration: 500, // speed of animation in ms
            easing: 'cubic-in-out'
        },
        frame: { duration: 500, redraw: true }
    });

    Plotly.relayout(id, {'title.text': label});
}