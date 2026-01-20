"use strict";

import { state } from "./state";
import { getData } from "./data_methods";
import { calculateApplianceCost, calculateApplianceDelayStart } from "./appliance_utils";
import { validateInt, escapeHtml, setLS, minMovingAverage } from "./utils";
import { closeModal } from "./modal_logic";

import type { Appliance } from "./appliance_utils";

function spawnApplianceWidget(appliance: Appliance) {
  const widgetTemplate = document.getElementById("widgetTemplate");
  const applianceWidget = (widgetTemplate! as HTMLTemplateElement).content.cloneNode(true) as DocumentFragment;
  const applianceContainer = applianceWidget.querySelector('[data-type="applianceWidget"') as HTMLDivElement;
  applianceContainer.id = appliance.id;
  Object.keys(appliance).forEach(function (key) {
    if (["id", "startAt", "runTime"].includes(key)) return;
    var applianceField = applianceContainer.querySelector(`[data-field="${key}"]`) as HTMLParagraphElement;
    applianceField.textContent = String(appliance[key as keyof Appliance]);
  });
  const span = applianceContainer.getElementsByClassName("close")[0];
  span.addEventListener("click", () => { removeAppliance(appliance) });
  document.getElementById("dynamicBlockGrid")!.appendChild(applianceContainer);
};

export async function updateAppliance(appliance: Appliance, initial = false) {
  let period_from = new Date();
  let period_to = new Date(period_from.valueOf());
  period_to.setDate(period_from.getDate() + 2);
  const intervals = appliance.runTime.hours * 2 + Math.ceil(appliance.runTime.minutes / 30);
  let res = await getData(period_from, period_to);
  let unit = res.map(a => a.value_inc_vat);
  let valid_from = res.map(a => a.valid_from);
  let cheapestWindow = minMovingAverage(unit, intervals);
  const avg_cost = Math.round(cheapestWindow.sum * 100 + Number.EPSILON) / (100 * intervals);

  const startTime = new Date(valid_from.at(cheapestWindow.startIndex)!);
  appliance.startAt = startTime;
  calculateApplianceCost(appliance, avg_cost);
  calculateApplianceDelayStart(appliance);

  const start_day = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(appliance.startAt);

  const startHour = ("0" + appliance.startAt.getHours()).slice(-2);
  const startMinute = ("0" + appliance.startAt.getMinutes()).slice(-2);

  const fields: any = {
    startAt: `${start_day} ${startHour}:${startMinute}`,
    hours: `${appliance.runTime!.hours}`,
    minutes: `${appliance.runTime!.minutes}`,
    delayStart: `${appliance.delayStart!.hours}h ${appliance.delayStart!.minutes}m`,
    cost: String(appliance.cost),
  };

  const applianceContainer = document.getElementById(appliance.id)!;
  Object.keys(fields).forEach(function (key) {
    var applianceField = applianceContainer.querySelector(`[data-field="${key}"]`) as HTMLParagraphElement;
    applianceField.textContent = String(fields[key]);
  });

  if (!state.nextAvailable) {
    var warn = applianceContainer.querySelector('[data-field="warning"]') as HTMLSpanElement;
    warn.style.display = "inline-block";
  };
  if (initial) {
    requestAnimationFrame(() => {
      applianceContainer.classList.add("show");
    });
  };
};

export async function parseAppliance() {
  const appliance_name = escapeHtml(((document.getElementById("appName") as HTMLInputElement)!).value);
  const appliance_power = validateInt(escapeHtml(((document.getElementById("appPower") as HTMLInputElement)!).value), 0, 20000);
  const appliance_hours = validateInt(escapeHtml(((document.getElementById("appRunHours") as HTMLInputElement)!).value), 0, 16);
  const appliance_minutes = validateInt(escapeHtml(((document.getElementById("appRunMinutes") as HTMLInputElement)!).value), 0, 59);

  if (appliance_power == -1 || appliance_hours == -1 || appliance_minutes == -1) {
    document.getElementById("applianceErr")!.style.display = "block";
    return;
  };
  document.getElementById("applianceErr")!.style.display = "none";

  let new_appliance = {
    id: self.crypto.randomUUID(),
    name: appliance_name,
    runTime: { hours: appliance_hours, minutes: appliance_minutes },
    power: appliance_power,
  };

  state.appliances.push(new_appliance);

  setLS("appliances", state.appliances);

  if (state.appliances.length > 7) {
    ((document.getElementById("newAppliance") as HTMLInputElement)!).disabled = true;
  };

  await addAppliance(new_appliance);
  closeModal();
};

export async function addAppliance(new_appliance: Appliance) {
  spawnApplianceWidget(new_appliance);
  await updateAppliance(new_appliance, true);
};

function removeAppliance(appliance: Appliance) {
  let applianceContainer = document.getElementById(appliance.id) as HTMLDivElement;
  applianceContainer.classList.remove("show");
  applianceContainer.addEventListener("transitionend", () => {
    applianceContainer.remove();
  });
  var index = state.appliances.indexOf(appliance);
  state.appliances.splice(index, 1);
  setLS("appliances", state.appliances);
  if (state.appliances.length < 8) {
    ((document.getElementById("newAppliance") as HTMLInputElement)!).disabled = false;
  }
};


