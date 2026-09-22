"use strict";

const turn = document.querySelector("#turn");
const setup = document.querySelector("#setup");
let queue = Promise.resolve();

function paint(state) {
  const on = !!state.enabled;
  turn.textContent = on ? "Turn off" : "Turn on";
  turn.classList.toggle("is-on", on);
  turn.setAttribute("aria-pressed", on ? "true" : "false");
  for (const button of document.querySelectorAll("[data-site]")) {
    const checked = !!(state.sites && state.sites[button.dataset.site]);
    button.setAttribute("aria-checked", checked ? "true" : "false");
  }
}

function update(mutate) {
  queue = queue.then(async () => {
    const next = JEV.mergeState(await chrome.storage.local.get(null));
    mutate(next);
    await chrome.storage.local.set(next);
    paint(next);
  }).catch(() => {});
}

function refresh() {
  queue = queue.then(async () => {
    paint(JEV.mergeState(await chrome.storage.local.get(null)));
  }).catch(() => {});
}

turn.addEventListener("click", () => {
  update((next) => {
    next.enabled = !next.enabled;
  });
});

for (const button of document.querySelectorAll("[data-site]")) {
  button.addEventListener("click", () => {
    const id = button.dataset.site;
    update((next) => {
      next.sites[id] = !next.sites[id];
    });
  });
}

setup.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  refresh();
});

refresh();
