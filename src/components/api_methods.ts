"use strict";

import { escapeHtml } from "./utils.js";

async function get(url: string, params = {}) {
    let response = await fetch(url, params);
    if (response.ok) {
        let json = await response.json();
        return json;
    } else {
        console.log(response.status);
        return {};
    }
}

export function getMeter(userInfo: any) {
    let headers = new Headers();
    const url = `https://api.octopus.energy/v1/accounts/${escapeHtml(userInfo.accountNumber)}`;
    const enc = window.btoa(escapeHtml(userInfo.apiKey));
    headers.set('Authorization', `Basic ${enc}`);
    const params = {method: "GET", headers: headers};
    return get(url, params);
};

export function getUnitData(region: string, period_from: Date, period_to: Date) {
    let url = `https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-${region}/standard-unit-rates?`
    url += new URLSearchParams({page_size: "25000", period_from: period_from.toISOString(), period_to: period_to.toISOString()});
    return get(url);
}

export function getConsumptionData(userInfo: any, period_from: Date, period_to: Date) {
    let headers = new Headers();
    let url = `https://api.octopus.energy/v1/electricity-meter-points/${userInfo.mpan}/meters/${userInfo.serialNumber}/consumption?`;
    url += new URLSearchParams({page_size: "25000", period_from: period_from.toISOString(), period_to: period_to.toISOString()});
    const enc = window.btoa(escapeHtml(userInfo.apiKey));
    headers.set('Authorization', `Basic ${enc}`);
    const params = {method: "GET", headers: headers};
    return get(url, params);
}