"use strict";

import type { Region } from "./db_types";
import type { Appliance } from "./appliance_utils";

type State = {
  region: Region;
  nextAvailable: Boolean;
  appliances: Appliance[];
  isMobile: Boolean;
  openModal: string;
};

const _state: State = {
  region: 'A',
  nextAvailable: false,
  appliances: [{ id: 'default', name: 'Washing machine', power: 2000, runTime: { hours: 2, minutes: 30 } }],
  isMobile: false,
  openModal: "",
};

export const state = new Proxy(_state, {
  get(target, prop: keyof State) {
    return target[prop];
  },
  set(target, prop: keyof State, value) {
    target[prop] = value;
    return true;
  },
});
