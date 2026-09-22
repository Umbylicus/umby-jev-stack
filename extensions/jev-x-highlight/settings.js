"use strict";

let state = JEV.mergeState(null);
let queue = Promise.resolve();

function update(mutate) {
  queue = queue.then(async () => {
    const next = JEV.mergeState(await chrome.storage.local.get(null));
    mutate(next);
    await chrome.storage.local.set(next);
    state = next;
    paint();
  }).catch(() => {});
}

function setIfIdle(id, value) {
  const el = document.querySelector("#" + id);
  if (!el || document.activeElement === el) return;
  const next = value == null ? "" : String(value);
  if (el.value !== next) el.value = next;
}

function paintSwitches() {
  for (const button of document.querySelectorAll("[data-feature]")) {
    const on = !!(state.features && state.features[button.dataset.feature]);
    button.setAttribute("aria-checked", on ? "true" : "false");
  }
  for (const button of document.querySelectorAll("#sites [data-site]")) {
    const on = !!(state.sites && state.sites[button.dataset.site]);
    button.setAttribute("aria-checked", on ? "true" : "false");
  }
  for (const button of document.querySelectorAll("[data-day]")) {
    const on = state.workHours.days.includes(Number(button.dataset.day));
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function paintPhraseList(id, phrases, key) {
  const list = document.querySelector("#" + id);
  list.replaceChildren();
  for (const phrase of phrases) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = phrase;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "remove";
    button.textContent = "Remove";
    button.setAttribute("aria-label", "Remove " + phrase);
    button.addEventListener("click", () => {
      update((next) => {
        next[key] = next[key].filter((item) => item.toLowerCase() !== phrase.toLowerCase());
      });
    });
    li.append(span, button);
    list.append(li);
  }
}

function paintReading() {
  const list = document.querySelector("#reading-list");
  const q = document.querySelector("#reading-search").value.trim().toLowerCase();
  const items = (state.readingList || []).filter((item) => {
    if (!item) return false;
    if (!q) return true;
    return [item.title, item.text, item.url].some((part) => String(part || "").toLowerCase().indexOf(q) !== -1);
  });
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = q ? "Nothing matches." : "Nothing saved.";
    list.append(empty);
    return;
  }
  for (const item of items.slice().reverse()) {
    const li = document.createElement("li");
    const copy = document.createElement("div");
    copy.className = "copy";
    if (item.title) {
      const title = document.createElement("strong");
      title.textContent = item.title;
      copy.append(title);
    }
    if (item.text) {
      const text = document.createElement("p");
      text.textContent = item.text;
      copy.append(text);
    }
    const link = document.createElement("a");
    link.textContent = item.url || "";
    if (/^https?:\/\//i.test(item.url || "")) {
      link.setAttribute("href", item.url);
      link.setAttribute("rel", "noopener noreferrer");
      link.setAttribute("target", "_blank");
    }
    copy.append(link);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "remove";
    button.textContent = "Remove";
    button.addEventListener("click", () => {
      const url = item.url;
      update((next) => {
        next.readingList = next.readingList.filter((entry) => entry.url !== url);
      });
    });
    li.append(copy, button);
    list.append(li);
  }
}

function paintFields() {
  setIfIdle("hours-start", state.workHours.start);
  setIfIdle("hours-end", state.workHours.end);
  setIfIdle("must-haves", state.mustHaveText);
  setIfIdle("job-can-do", state.jobCanDo);
  setIfIdle("profile-name", state.profile.name);
  setIfIdle("profile-email", state.profile.email);
  setIfIdle("profile-phone", state.profile.phone);
  setIfIdle("profile-address", state.profile.address);
  setIfIdle("business-name", state.business.name);
  setIfIdle("business-phone", state.business.phone);
  setIfIdle("business-address", state.business.address);
  setIfIdle("api-key", state.apiKey);
}

function paint() {
  paintSwitches();
  paintPhraseList("interest-list", state.interests, "interests");
  paintPhraseList("not-interest-list", state.notInterests, "notInterests");
  paintPhraseList("gold-account-list", state.goldAccounts, "goldAccounts");
  paintPhraseList("red-account-list", state.redAccounts, "redAccounts");
  paintReading();
  paintFields();
}

function paintSession(counts) {
  const bag = counts || {};
  document.querySelector("#session-gold").textContent = String(Number(bag.gold) || 0);
  document.querySelector("#session-red").textContent = String(Number(bag.bad) || 0);
}

function loadSession() {
  if (!chrome.storage || !chrome.storage.session) return Promise.resolve({});
  return chrome.storage.session.get("jevCounts").then((stored) => (stored && stored.jevCounts) || {});
}

function bindAdder(inputId, buttonId, key) {
  const input = document.querySelector("#" + inputId);
  const button = document.querySelector("#" + buttonId);
  const add = () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    update((next) => {
      const exists = next[key].some((item) => item.toLowerCase() === text.toLowerCase());
      if (!exists) next[key] = next[key].concat(text);
    });
  };
  button.addEventListener("click", add);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add();
  });
}

function clockValue(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ""));
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return "";
  return String(hour).padStart(2, "0") + ":" + match[2];
}

function bindText(id, apply) {
  const el = document.querySelector("#" + id);
  el.addEventListener("input", () => {
    const value = el.value;
    update((next) => apply(next, value));
  });
}

bindAdder("interest-input", "interest-add", "interests");
bindAdder("not-interest-input", "not-interest-add", "notInterests");
bindAdder("gold-account-input", "gold-account-add", "goldAccounts");
bindAdder("red-account-input", "red-account-add", "redAccounts");

for (const button of document.querySelectorAll("[data-feature]")) {
  button.addEventListener("click", () => {
    const id = button.dataset.feature;
    update((next) => {
      next.features[id] = !next.features[id];
    });
  });
}

for (const button of document.querySelectorAll("#sites [data-site]")) {
  button.addEventListener("click", () => {
    const id = button.dataset.site;
    update((next) => {
      next.sites[id] = !next.sites[id];
    });
  });
}

for (const button of document.querySelectorAll("[data-day]")) {
  button.addEventListener("click", () => {
    const day = Number(button.dataset.day);
    update((next) => {
      const has = next.workHours.days.includes(day);
      next.workHours.days = has
        ? next.workHours.days.filter((item) => item !== day)
        : next.workHours.days.concat(day);
    });
  });
}

document.querySelector("#open-shortcuts").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

document.querySelector("#reading-search").addEventListener("input", () => paintReading());

document.querySelector("#hours-start").addEventListener("input", () => {
  const clock = clockValue(document.querySelector("#hours-start").value);
  if (!clock) return;
  update((next) => { next.workHours.start = clock; });
});

document.querySelector("#hours-end").addEventListener("input", () => {
  const clock = clockValue(document.querySelector("#hours-end").value);
  if (!clock) return;
  update((next) => { next.workHours.end = clock; });
});

bindText("must-haves", (next, value) => { next.mustHaveText = value; });
bindText("job-can-do", (next, value) => { next.jobCanDo = value; });
bindText("profile-name", (next, value) => { next.profile.name = value; });
bindText("profile-email", (next, value) => { next.profile.email = value; });
bindText("profile-phone", (next, value) => { next.profile.phone = value; });
bindText("profile-address", (next, value) => { next.profile.address = value; });
bindText("business-name", (next, value) => { next.business.name = value; });
bindText("business-phone", (next, value) => { next.business.phone = value; });
bindText("business-address", (next, value) => { next.business.address = value; });
bindText("api-key", (next, value) => { next.apiKey = value; });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.jevCounts) {
    paintSession(changes.jevCounts.newValue || {});
    return;
  }
  if (area !== "local") return;
  queue = queue.then(async () => {
    state = JEV.mergeState(await chrome.storage.local.get(null));
    paint();
  }).catch(() => {});
});

queue = queue.then(async () => {
  state = JEV.mergeState(await chrome.storage.local.get(null));
  paint();
  paintSession(await loadSession());
}).catch(() => {});
