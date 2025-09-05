"use strict";

async function get(url, params = {}) {
    let response = await fetch(url, params);
    if (response.ok) {
        let json = await response.json();
        return json;
    } else {
        console.log(response.status);
        return {};
    }
}

export function getMeter(userInfo) {
    let headers = new Headers();
    const url = `https://api.octopus.energy/v1/accounts/${escapeHtml(userInfo.accountNumber)}`;
    const enc = window.btoa(escapeHtml(userInfo.apiKey));
    headers.set('Authorization', `Basic ${enc}`);
    const params = {method: "GET", headers: headers};
    return get(url, params);
};

export function getUnitData(region, period_from, period_to) {
    let url = `https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-${region}/standard-unit-rates?`
    url += new URLSearchParams({page_size: 25000, period_from: period_from.toISOString(), period_to: period_to.toISOString()});
    return get(url);
}

export function getConsumptionData(userInfo, period_from, period_to) {
    let headers = new Headers();
    let url = `https://api.octopus.energy/v1/electricity-meter-points/${userInfo.mpan}/meters/${userInfo.serialNumber}/consumption?`;
    url += new URLSearchParams({page_size: 25000, period_from: period_from.toISOString(), period_to: period_to.toISOString()});
    const enc = window.btoa(escapeHtml(userInfo.apiKey));
    headers.set('Authorization', `Basic ${enc}`);
    const params = {method: "GET", headers: headers};
    return get(url, params);
}