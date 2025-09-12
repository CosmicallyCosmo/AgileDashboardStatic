"use strict";

export type Params = {
    method: string;
    headers: Headers;
    cache: RequestCache;
}

export type JWTToken = {
    token: string;
    expiry: Date;
};

export type Meter = {
    mpan: string;
    serialNumber: string;
}

export type MeterPoint = {
  properties: {
    electricity_meter_points: {
      mpan: string,
      meters: {
        serial_number: string;
      }[];
    }[];
  }[];
};

export type UserInfo = {
    accountNumber?: string;
    token?: JWTToken;
    refreshToken?: JWTToken;
    meter?: Meter; // ephemeral, not stored in LS
}

export type ObtainKrakenTokenResponse = {
  obtainKrakenToken: {
    token: string;
    refreshToken: string;
    refreshExpiresIn: number;
  };
};