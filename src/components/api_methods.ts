"use strict";

import { state } from "./state.ts";
import { escapeHtml, rmLS } from "./utils.ts";
import { request, gql } from 'graphql-request';
import type { Params, UserInfo, ObtainKrakenTokenResponse, MeterPoint } from './api_types.ts';
import type { TariffCode } from "./db_types.ts";

async function get(url: string, params?: Params, auth = false, userInfo?: UserInfo) {
  let now = new Date();
  if (!params)
    params = { method: "GET", headers: new Headers(), cache: "no-store" };
  if (auth) {
    if (!userInfo)
      throw new Error("Tried to call get with auth without passing userInfo!");
    if (!userInfo.token || now.getTime() > (userInfo.token.expiry).getTime()) {
      let res = await getToken();
      if (!res) {
        return {};
      };
    };
    params.headers.set('Authorization', `${userInfo.token!.token}`);
  }
  params.cache = "no-store";
  let response = await fetch(url, params);
  if (response.ok) {
    let json = await response.json();
    return json;
  } else {
    return {};
  };
}

export async function getToken(APIKey?: string) {
  let now = new Date();
  let authMethod;
  if (APIKey) {
    authMethod = { APIKey: APIKey };
  } else {
    if (!state.userInfo.refreshToken || now.getTime() > (state.userInfo.refreshToken.expiry).getTime()) {  // Check if not preesnt or expired
      rmLS("userInfo");
      return false;
    };
    authMethod = { refreshToken: state.userInfo.refreshToken!.token };
  };
  const query = gql`
        mutation ObtainKrakenToken($authMethod: ObtainJSONWebTokenInput!) {
            obtainKrakenToken(input: $authMethod) {
                token
                refreshToken
                refreshExpiresIn
                }
            }
    `
  let variables = { authMethod };
  console.log(variables);
  try {
    var res = ((await request<ObtainKrakenTokenResponse>('https://api.octopus.energy/v1/graphql/', query, variables)).obtainKrakenToken);
  } catch (error) {
    console.log(error);
    return false;
  }
  let tokenExpiresIn = new Date();
  tokenExpiresIn.setMinutes(tokenExpiresIn.getMinutes() + 55); // 5 minute leeway;
  state.userInfo.token = { token: res.token, expiry: tokenExpiresIn };
  state.userInfo.refreshToken = { token: res.refreshToken, expiry: new Date(res.refreshExpiresIn * 1000) };
  return true;
}

export async function getUnitData(region: string, period_from: Date, period_to: Date) {
  let url = `https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-${region}/standard-unit-rates?`
  url += new URLSearchParams({ page_size: "25000", period_from: period_from.toISOString(), period_to: period_to.toISOString(), _: (new Date()).toISOString() });
  return await get(url);
}

export async function getGoData(period_from: Date, period_to: Date) {
  let url = `https://api.octopus.energy/v1/products/GO-VAR-22-10-14/electricity-tariffs/E-1R-GO-VAR-22-10-14-A/standard-unit-rates?`
  url += new URLSearchParams({ page_size: "25000", period_from: period_from.toISOString(), period_to: period_to.toISOString(), _: (new Date()).toISOString() });
  return await get(url);
}

export async function getMeter(mpan?: string, serialNumber?: string) {
  if (!mpan || !serialNumber) {
    const url = `https://api.octopus.energy/v1/accounts/${escapeHtml(state.userInfo.accountNumber!)}`;
    try {
      let res = await get(url, undefined, true, state.userInfo) as MeterPoint;
      let property = res.properties.at(0);
      let electricity_meter_point = property?.electricity_meter_points.at(0);
      mpan = electricity_meter_point!.mpan;
      let meter = electricity_meter_point?.meters.at(-1);
      serialNumber = meter!.serial_number;
    } catch (error) {
      return false;
    };
  };
  state.userInfo.meter = { mpan: mpan, serialNumber: serialNumber };
  return true;
};

export async function getStandingCharge(tariffCode: TariffCode, period_from: Date, period_to: Date) {
  let url = `https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-${tariffCode}/standing-charges?`
  if (tariffCode == "Go")
    url = "https://api.octopus.energy/v1/products/GO-VAR-22-10-14/electricity-tariffs/E-1R-GO-VAR-22-10-14-A/standing-charges?"
  url += new URLSearchParams({ page_size: "25000", period_from: period_from.toISOString(), period_to: period_to.toISOString(), _: (new Date()).toISOString() });
  return await get(url);
}

export async function getConsumptionData(period_from: Date, period_to: Date) {
  if (!state.userInfo.meter) {
    await getMeter(undefined, undefined);
  }
  let url = `https://api.octopus.energy/v1/electricity-meter-points/${state.userInfo.meter!.mpan}/meters/${state.userInfo.meter!.serialNumber}/consumption?`;
  url += new URLSearchParams({ page_size: "25000", period_from: period_from.toISOString(), period_to: period_to.toISOString(), _: (new Date()).toISOString() });
  return await get(url, undefined, true, state.userInfo);
}
