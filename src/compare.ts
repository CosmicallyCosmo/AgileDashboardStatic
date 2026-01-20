"use strict";

declare const CookiesEuBanner: any;

import { state } from "./components/state.ts";
import { setCookie, getCookie, getLondonDayRangeAsDate, rotateMenuIcon, rmLS, getLS } from "./components/utils.ts";
import { getNextAvailable, getData } from "./components/data_methods.ts";
import { regionMap } from "./components/db_types.ts";
import { openModal, closeModal } from "./components/modal_logic.ts";
import { updateGraphs, selectGraph } from "./components/graph_logic.ts";
import { initialiseUser, storeUserData } from "./components/settings_logic.ts";

import type { TariffCode } from "./components/db_types.ts";

import "./styles/styles.css";

const right = (document.getElementById("right") as HTMLInputElement);
const left = (document.getElementById("left") as HTMLInputElement);

function layoutCallback(e: any) {
  let select = document.getElementById("regionSelector") as HTMLSelectElement;
  let graphSelector = document.getElementById("graphSelector") as HTMLDivElement;
  let graphSelectorDesktopContainer = document.getElementById("graphContainer") as HTMLDivElement;
  let graphSelectorMobileContainer = document.getElementById("floatingControls") as HTMLDivElement;
  let buttonsMobileContainer = document.getElementById("buttonControls") as HTMLDivElement;
  let leftButtonDesktopContainer = document.getElementById("leftbcolumn") as HTMLDivElement;
  let rightButtonDesktopContainer = document.getElementById("rightbcolumn") as HTMLDivElement;
  let selectDesktopContainer = document.getElementById("navSelect") as HTMLDivElement;
  let selectMobileContainer = document.getElementById("settingsModal")!.querySelector(".modal-content") as HTMLDivElement;
  if (e.matches) { // Mobile
    let br = document.createElement("br");
    selectMobileContainer.prepend(select, br, br);
    graphSelectorMobileContainer.append(graphSelector);
    buttonsMobileContainer.prepend(right);
    buttonsMobileContainer.prepend(left);
    state.isMobile = true;
  } else {
    selectDesktopContainer.appendChild(select);
    graphSelectorDesktopContainer.prepend(graphSelector);
    rightButtonDesktopContainer.prepend(right);
    leftButtonDesktopContainer.prepend(left);
    selectDesktopContainer.style.visibility = "visible";
  }
  select.style.display = "inline-block";
  graphSelector.style.visibility = "visible";
};

export function modifyButton(id: string, disabled: boolean) {
  if (id == "left") {
    left.disabled = disabled;
  } else {
    right.disabled = disabled;
  };
};

async function buttonCb(id: string) {
  if (id == 'right') {
    state.offset += 1;
  } else {
    state.offset -= 1;
  }

  const disabled = (state.offset == 1 || (state.offset == 0 && !state.nextAvailable));

  right.disabled = true;
  left.disabled = true;

  await updateGraphs(false, id, "compareBar");
  right.disabled = disabled;
  left.disabled = false;
};

(async () => {

  document.addEventListener("DOMContentLoaded", async function () {
    state.region = getCookie("region", "A");
    (document.getElementById("regionSelector") as HTMLInputElement)!.value = state.region;
    (document.getElementById("selectedRegion") as HTMLSpanElement).textContent = regionMap[state.region];

    new CookiesEuBanner(function () {
      state.appliances = getLS("appliances") || state.appliances;
    });

    let gather_futs: Promise<void>[] = [];

    await updateGraphs(true, "right", "compareBar");
    state.nextAvailable = (await getNextAvailable());

    right.disabled = !state.nextAvailable;

    await Promise.all(gather_futs);

    if (await initialiseUser()) {
      (document.getElementById("selectConsumption") as HTMLButtonElement).classList.remove("noHover");
      (document.getElementById("selectCost") as HTMLButtonElement).classList.remove("noHover");
    } else {
      rmLS("userInfo");
    };

    left.addEventListener("click", () => { buttonCb('left') });
    right.addEventListener("click", () => { buttonCb('right') });

    document.getElementById("regionSelector")!.addEventListener("change", async (event) => {
      state.region = ((event.target as HTMLInputElement)!).value as TariffCode;
      (document.getElementById("selectedRegion") as HTMLSpanElement).textContent = regionMap[state.region];
      setCookie("region", ((event.target as HTMLInputElement)!).value, 365);

      let gather_futs: Promise<void>[] = [];

      let dt_range = getLondonDayRangeAsDate(0);
      await getData(dt_range.start, dt_range.end, true);
      await updateGraphs(false, "right", "compareBar"); // TODO: fix

      await Promise.all(gather_futs);
    });

    const mediaQuery = window.matchMedia("(max-width: 1100px)");
    layoutCallback(mediaQuery);

    mediaQuery.addEventListener("change", layoutCallback);
    (document.getElementById("compare-link")!).classList.add("disabled");
    (document.getElementById("settingsButton")!).addEventListener("click", () => { openModal("settingsModal") });
    (document.getElementById("addDetailsButton")!).addEventListener("click", () => { storeUserData() });
    (document.getElementById("selectUnit")!).addEventListener("click", () => { selectGraph("unitBar", "compareBar") });
    (document.getElementById("selectConsumption")!).addEventListener("click", () => { selectGraph("consumptionBar", "compareBar") });
    (document.getElementById("selectCost")!).addEventListener("click", () => { selectGraph("costBar", "compareBar") });

    let settingsMenu = document.getElementById("settingsMenu")!;
    settingsMenu.addEventListener("click", () => { openModal("settingsModal") });
    settingsMenu.addEventListener("click", () => { rotateMenuIcon() });

    let closeModalArr = document.getElementsByClassName("closeModal");
    for (var i = 0; i < closeModalArr.length; i++)
      closeModalArr[i].addEventListener("click", () => { closeModal() });

    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function (event) {
      if (state.openModal && event.target == document.getElementById(state.openModal!)) {
        closeModal();
      }
    }
  });
})()
