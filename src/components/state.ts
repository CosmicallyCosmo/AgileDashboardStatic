"use strict";

import type { TariffCode } from "./db_types";
import type { Appliance } from "./appliance_utils";
import type { UserInfo } from "./api_types";

type State = {
  region: TariffCode;
  nextAvailable: Boolean;
  appliances: Appliance[];
  isMobile: Boolean;
  openModal: string;
  offset: number;
  userInfo: UserInfo;
};

const _state: State = {
  region: 'A',
  nextAvailable: false,
  appliances: [{ id: 'default', name: 'Washing machine', power: 2000, runTime: { hours: 2, minutes: 30 } }],
  isMobile: false,
  openModal: "",
  offset: 0,
  userInfo: { accountNumber: undefined },
};

export const state = new Proxy(_state, {
  get(target, prop: keyof State) {
    return target[prop];
  },
  set(target, prop: keyof State, value) {
    (target as any)[prop] = value;
    return true;
  },
});
