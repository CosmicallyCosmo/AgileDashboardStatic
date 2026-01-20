"use strict";

import { getLS, setLS, rmLS, escapeHtml } from "./utils";
import { state } from "./state";
import { getToken, getMeter } from "./api_methods";
import { closeModal } from "./modal_logic";

import type { UserInfo } from "./api_types";

export function settingsErr(msg: string) {
  let errContainer = document.getElementById("settingsErr") as HTMLParagraphElement;
  errContainer.innerHTML = msg;
};

export async function initialiseUser(accountNumber?: string, APIKey?: string, mpan?: string, serialNumber?: string, rememberMe = false) {
  if (!accountNumber || !APIKey) {
    let res: UserInfo = getLS("userInfo");
    if (!res)
      return false;
    res.refreshToken!.expiry = new Date(res.refreshToken!.expiry);
    res.token!.expiry = new Date(res.token!.expiry);
    state.userInfo = res;
    let isValid = await getToken();
    if (!isValid) {
      settingsErr("Unable to authenticate with provided details via the Octopus API - please double check!");
      return isValid;
    };
    isValid = await getMeter(mpan, serialNumber);
    if (!isValid) {
      settingsErr("Unable to get meter details via the Octopus API - do you have a smart meter?");
    };
    return isValid;
  };
  state.userInfo.accountNumber = accountNumber;
  let isValid = await getToken(APIKey);
  if (!isValid) {
    settingsErr("Unable to authenticate with provided details via the Octopus API - please double check!");
    return isValid;
  };
  isValid = await getMeter(mpan, serialNumber);
  if (!isValid) {
    settingsErr("Unable to get meter details via the Octopus API - do you have a smart meter?");
    return isValid;
  };
  if (isValid) {
    if (rememberMe) {
      setLS("userInfo", state.userInfo);
    } else {
      rmLS("userInfo");
    };
  };
  return isValid;
}

export async function storeUserData() {
  const apiKey = escapeHtml(((document.getElementById("APIKey") as HTMLInputElement)!).value);
  const accountNumber = escapeHtml(((document.getElementById("accountNumber") as HTMLInputElement)!).value);
  const mpan = escapeHtml(((document.getElementById("mpan") as HTMLInputElement)!).value) || undefined;
  const serialNumber = escapeHtml(((document.getElementById("serialNumber") as HTMLInputElement)!).value) || undefined;
  const rememberMe = ((document.getElementById("rememberMe") as HTMLInputElement)!).checked;
  let err = false;
  if (apiKey.length === 0 || accountNumber.length === 0)
    err = true;
  let res = await initialiseUser(accountNumber, apiKey, mpan, serialNumber, rememberMe);
  if (!res)
    err = true;
  if (err) {
    document.getElementById("settingsErr")!.style.display = "block";
    return;
  }
  document.getElementById("settingsErr")!.style.display = "none";
  (document.getElementById("selectConsumption") as HTMLButtonElement).classList.remove("noHover");
  (document.getElementById("selectCost") as HTMLButtonElement).classList.remove("noHover");
  closeModal();
  document.getElementById("manualDetailsEntry")!.style.display = "block";
};

