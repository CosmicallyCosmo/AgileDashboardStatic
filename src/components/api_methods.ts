"use strict";

declare const CookiesEuBanner: any;

import { escapeHtml } from "./utils.ts";
import { request, gql } from 'graphql-request';
import type { Params, UserInfo, ObtainKrakenTokenResponse, MeterPoint } from './api_types.ts';

export let userInfo: UserInfo = { accountNumber: undefined };

async function get(url: string, params?: Params, auth = false, userInfo?: UserInfo) {
  let now = new Date();
  if (!params)
    params = { method: "GET", headers: new Headers() };
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
  let response = await fetch(url, params);
  if (response.ok) {
    let json = await response.json();
    return json;
  } else {
    return {};
  };
}

export async function initialiseUser(accountNumber?: string, APIKey?: string, rememberMe = false) {
  if (!accountNumber || !APIKey) {
    let res: UserInfo = JSON.parse(localStorage.getItem("userInfo")!);
    if (!res)
      return false;
    res.refreshToken!.expiry = new Date(res.refreshToken!.expiry);
    res.token!.expiry = new Date(res.token!.expiry);
    userInfo = res;
    let isValid = await getToken();
    isValid = await getMeter();
    return isValid;
  };
  userInfo.accountNumber = accountNumber;
  let isValid = await getToken(APIKey);
  isValid = await getMeter();
  if (isValid) {
    if (rememberMe) {
      new CookiesEuBanner(function () {
        localStorage.setItem("userInfo", JSON.stringify(userInfo));
      });
    } else {
      localStorage.removeItem("userInfo");
    };
  };
  return isValid;
}

export async function getToken(APIKey?: string) {
  let now = new Date();
  let authMethod;
  if (APIKey) {
    authMethod = { APIKey: APIKey };
  } else {
    if (!userInfo.refreshToken || now.getTime() > (userInfo.refreshToken.expiry).getTime()) {  // Check if not preesnt or expired
      localStorage.removeItem("userInfo");
      return false;
    };
    authMethod = { refreshToken: userInfo.refreshToken!.token };
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
  try {
    var res = ((await request<ObtainKrakenTokenResponse>('https://api.octopus.energy/v1/graphql/', query, variables)).obtainKrakenToken);
  } catch (error) {
    return false;
  }
  let tokenExpiresIn = new Date();
  tokenExpiresIn.setMinutes(tokenExpiresIn.getMinutes() + 55); // 5 minute leeway;
  userInfo.token = { token: res.token, expiry: tokenExpiresIn };
  userInfo.refreshToken = { token: res.refreshToken, expiry: new Date(res.refreshExpiresIn * 1000) };
  return true;
}

export async function getUnitData(region: string, period_from: Date, period_to: Date) {
  let url = `https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-${region}/standard-unit-rates?`
  url += new URLSearchParams({ page_size: "25000", period_from: period_from.toISOString(), period_to: period_to.toISOString() });
  return await get(url);
}

export async function getMeter() {
  const url = `https://api.octopus.energy/v1/accounts/${escapeHtml(userInfo.accountNumber!)}`;
  try {
    let res = await get(url, undefined, true, userInfo) as MeterPoint;
    let property = res.properties.at(0);
    let electricity_meter_point = property?.electricity_meter_points.at(0);
    let mpan = electricity_meter_point!.mpan;
    let meter = electricity_meter_point?.meters.at(-1);
    let serialNumber = meter!.serial_number;
    userInfo.meter = { mpan: mpan, serialNumber: serialNumber };
    return true;
  } catch (error) {
    return false;
  };
};

export async function getConsumptionData(period_from: Date, period_to: Date) {
  if (!userInfo.meter) {
    await getMeter();
  }
  let url = `https://api.octopus.energy/v1/electricity-meter-points/${userInfo.meter!.mpan}/meters/${userInfo.meter!.serialNumber}/consumption?`;
  url += new URLSearchParams({ page_size: "25000", period_from: period_from.toISOString(), period_to: period_to.toISOString() });
  return await get(url, undefined, true, userInfo);
}
