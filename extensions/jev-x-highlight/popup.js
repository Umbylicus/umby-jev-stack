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
  for (const button of document.querySelectorAll("[data-feature]")) {
    const checked = !!(state.features && state.features[button.dataset.feature]);
    button.setAttribute("aria-checked", checked ? "true" : "false");
  }
}

function update(mutate) {
  queue = queue.then(async () => {
    const next = JEV.mergeState(await chrome.storage.local.get(null));
    const features = Object.assign({}, next.features);
    const sites = Object.assign({}, next.sites);
    const enabled = next.enabled;
    mutate(next);
    next.features = Object.assign({}, features, next.features || {});
    next.sites = Object.assign({}, sites, next.sites || {});
    const patch = {};
    if (next.enabled !== enabled) patch.enabled = next.enabled;
    if (JSON.stringify(next.sites) !== JSON.stringify(sites)) patch.sites = next.sites;
    if (JSON.stringify(next.features) !== JSON.stringify(features)) patch.features = next.features;
    if (Object.keys(patch).length) await chrome.storage.local.set(patch);
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

for (const button of document.querySelectorAll("[data-feature]")) {
  button.addEventListener("click", () => {
    const id = button.dataset.feature;
    update((next) => {
      next.features[id] = !next.features[id];
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
