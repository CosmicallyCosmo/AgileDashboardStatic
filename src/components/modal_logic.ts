"use strict";

import { state } from "./state";
import { rotateMenuIcon } from "./utils";

export function closeModal() {
  let modal = document.getElementById(state.openModal!) as HTMLDivElement;
  let modalContent = modal!.querySelector(".modal-content")!;
  modalContent.classList.remove("show");
  modalContent.addEventListener("transitionend", () => {
    modal!.style.visibility = "hidden";
    if (modal!.id === "settingsModal" && state.isMobile)
      rotateMenuIcon(false);
  }, { once: true });
};

export function openModal(id: string) {
  let modal = document.getElementById(id)! as HTMLDivElement;
  state.openModal = id;
  requestAnimationFrame(() => {
    modal!.querySelector(".modal-content")!.classList.add("show");
  });
  modal.style.visibility = "visible";
};

