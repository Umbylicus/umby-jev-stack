"use strict";

importScripts("lib/contract.js", "lib/runtime.js", "lib/url.js", "lib/match.js", "docs/proposal.js");

const ignoredDupes = new Map();
const proposals = new Map();
let tail = Promise.resolve();
let lastDiffKey = "";
let lastDiffs = [];

function serial(fn) {
  const run = tail.then(fn, fn);
  tail = run.then(() => {}, () => {});
  return run;
}

function normalizedUrl(url) {
  const value = String(url || "");
  if (!value) return "";
  try {
    if (typeof JEVUrl !== "undefined" && typeof JEVUrl.normalize === "function") {
      const next = JEVUrl.normalize(value);
      return next == null ? "" : String(next);
    }
  } catch (err) {
    return value;
  }
  return value;
}

function isHttpPage(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function isExtensionUrl(url) {
  return /^chrome-extension:\/\//i.test(String(url || ""));
}

function isViewer(url) {
  try {
    return new URL(String(url || "")).pathname.endsWith("pdf-viewer.html");
  } catch (err) {
    return String(url || "").indexOf("pdf-viewer.html") !== -1;
  }
}

function makeId() {
  if (globalThis.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return String(Date.now());
}

function clip(value, max) {
  return Array.from(String(value || "")).slice(0, max).join("");
}

async function readState() {
  return JEV.mergeState(await chrome.storage.local.get(null));
}

async function paintBadge(enabled) {
  await chrome.action.setBadgeText({ text: enabled ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#d4a017" });
}

async function sendTab(tabId, payload) {
  if (tabId == null) return;
  try {
    await chrome.tabs.sendMessage(tabId, payload);
  } catch (err) {
    // A missing content script must not reject the worker.
  }
}

function messageUrl(message, sender) {
  if (message && typeof message.url === "string" && message.url) return message.url;
  if (sender && sender.tab && typeof sender.tab.url === "string") return sender.tab.url;
  return "";
}

function pdfBypassUrl(message, sender) {
  if (message && typeof message.url === "string" && message.url) return message.url;
  if (message && typeof message.src === "string" && message.src) return message.src;
  const tabUrl = sender && sender.tab && sender.tab.url;
  if (typeof tabUrl === "string" && tabUrl.indexOf("pdf-viewer.html") !== -1) {
    try {
      const src = new URL(tabUrl).searchParams.get("src");
      if (src) return src;
    } catch (err) {}
  }
  return typeof tabUrl === "string" ? tabUrl : "";
}

async function saveReading(message) {
  const state = await readState();
  if (!JEV.featureOn(state, JEV.FEATURES.readingList)) return { ok: false };
  const source = message && message.item && typeof message.item === "object" ? message.item : message;
  const url = source && typeof source.url === "string" ? source.url : "";
  if (!url) return { ok: false };
  const item = {
    id: source.id != null && String(source.id) ? String(source.id) : makeId(),
    url: url,
    title: clip(source.title, 300),
    text: clip(source.text, 280),
    site: clip(source.site, 40),
    savedAt: Date.now()
  };
  const list = (state.readingList || []).filter((entry) => entry && entry.url !== url);
  list.push(item);
  state.readingList = list.length > 200 ? list.slice(list.length - 200) : list;
  await chrome.storage.local.set(state);
  return { ok: true };
}

async function countMark(message) {
  const state = await readState();
  if (!JEV.featureOn(state, JEV.FEATURES.sessionCount)) return { ok: false };
  const mark = message.mark;
  if (mark !== "gold" && mark !== "bad") return { ok: false };
  const id = message.id != null ? String(message.id) : message.postId != null ? String(message.postId) : "";
  if (!id) return { ok: false };
  const stored = await chrome.storage.session.get("jevCounts");
  const raw = stored && stored.jevCounts && typeof stored.jevCounts === "object" ? stored.jevCounts : {};
  const seen = Array.isArray(raw.seen) ? raw.seen.map((item) => String(item)) : [];
  if (seen.indexOf(id) !== -1) return { ok: true };
  seen.push(id);
  const counts = {
    gold: Number(raw.gold) || 0,
    bad: Number(raw.bad) || 0,
    seen: seen.length > 2000 ? seen.slice(seen.length - 2000) : seen
  };
  counts[mark] += 1;
  await chrome.storage.session.set({ jevCounts: counts });
  return { ok: true };
}

function samePage(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    return typeof JEVUrl !== "undefined" && typeof JEVUrl.samePage === "function" && !!JEVUrl.samePage(a, b);
  } catch (err) {
    return false;
  }
}

function ignoreDuplicate(message, sender) {
  const tabId = sender && sender.tab && sender.tab.id;
  if (tabId == null) return { ok: false };
  const raw = messageUrl(message, sender);
  const key = normalizedUrl(raw);
  if (!key && !raw) return { ok: false };
  let set = ignoredDupes.get(tabId);
  if (!set) {
    set = new Set();
    ignoredDupes.set(tabId, set);
  }
  if (key) set.add(key);
  if (raw) set.add(raw);
  return { ok: true };
}

function hasIgnored(tabId, url) {
  const set = ignoredDupes.get(tabId);
  if (!set || !url) return false;
  const key = normalizedUrl(url);
  if ((key && set.has(key)) || set.has(url)) return true;
  for (const saved of set) {
    if (samePage(saved, url) || (key && samePage(saved, key))) return true;
  }
  return false;
}

async function closeDuplicate(message, sender) {
  const originalTabId = Number(message.originalTabId);
  const senderId = sender && sender.tab && sender.tab.id;
  if (!Number.isInteger(originalTabId) || senderId == null || senderId === originalTabId) return { ok: false };
  let original;
  try {
    original = await chrome.tabs.get(originalTabId);
    await chrome.tabs.update(originalTabId, { active: true });
  } catch (err) {
    return { ok: false };
  }
  try {
    if (original && original.windowId != null && chrome.windows && chrome.windows.update) {
      await chrome.windows.update(original.windowId, { focused: true });
    }
  } catch (err) {}
  try {
    await chrome.tabs.remove(senderId);
  } catch (err) {
    return { ok: false };
  }
  return { ok: true };
}

async function pruneProposals() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch (err) {
    return;
  }
  const byId = new Map();
  for (const tab of tabs) if (tab && tab.id != null) byId.set(tab.id, tab);
  for (const [tabId, item] of proposals) {
    const tab = byId.get(tabId);
    if (!tab) {
      proposals.delete(tabId);
      continue;
    }
    if (item.href && tab.url && item.href !== tab.url && !samePage(item.href, tab.url)) proposals.delete(tabId);
  }
}

async function takeProposal(message, sender) {
  const state = await readState();
  if (!JEV.featureOn(state, JEV.FEATURES.proposalDiff)) return { diffs: [] };
  const tabId = sender && sender.tab && sender.tab.id;
  const text = message.text == null ? "" : String(message.text);
  if (tabId == null || !text.trim()) return { waiting: true };
  await pruneProposals();
  proposals.set(tabId, {
    text: text,
    title: message.title == null ? "" : String(message.title),
    href: message.href == null ? "" : String(message.href),
    at: Date.now()
  });
  const ready = [];
  for (const entry of proposals) {
    if (String(entry[1].text || "").trim()) ready.push(entry);
  }
  if (ready.length < 2) {
    lastDiffKey = "";
    lastDiffs = [];
    return { waiting: true };
  }
  ready.sort((a, b) => {
    if (a[1].at !== b[1].at) return a[1].at - b[1].at;
    if (a[0] === tabId) return 1;
    if (b[0] === tabId) return -1;
    return a[0] - b[0];
  });
  const pair = ready.slice(-2);
  const diffKey = pair[0][0] + "\n" + pair[0][1].text + "\n" + pair[1][0] + "\n" + pair[1][1].text;
  if (diffKey === lastDiffKey) return { diffs: lastDiffs };
  let diffs = [];
  try {
    diffs = JEVProposal.diffProposals(pair[0][1].text, pair[1][1].text);
  } catch (err) {
    diffs = [];
  }
  if (diffs == null) diffs = [];
  lastDiffKey = diffKey;
  lastDiffs = diffs;
  const payload = { type: JEV.MSG.PROPOSAL_DIFF, diffs: diffs };
  await sendTab(pair[0][0], payload);
  await sendTab(pair[1][0], payload);
  return { diffs: diffs };
}

async function rememberPdfBypass(url) {
  const key = normalizedUrl(url);
  if (!key) return;
  const stored = await chrome.storage.session.get("pdfBypass");
  const map = stored && stored.pdfBypass && typeof stored.pdfBypass === "object" ? Object.assign({}, stored.pdfBypass) : {};
  map[key] = true;
  await chrome.storage.session.set({ pdfBypass: map });
}

async function pdfBypassed(url) {
  const key = normalizedUrl(url);
  const stored = await chrome.storage.session.get("pdfBypass");
  const map = stored && stored.pdfBypass;
  if (!map || typeof map !== "object") return false;
  if (key && map[key]) return true;
  if (map[url]) return true;
  for (const saved of Object.keys(map)) {
    if (samePage(saved, url) || (key && samePage(saved, key))) return true;
  }
  return false;
}

async function bypassPdf(message, sender) {
  await rememberPdfBypass(pdfBypassUrl(message, sender));
  return { ok: true };
}

async function maybePdf(tab) {
  const url = tab.url || "";
  if (!isHttpPage(url) || isViewer(url)) return false;
  const state = await readState();
  if (!JEV.featureOn(state, JEV.FEATURES.pdf)) return false;
  let pdf = false;
  try {
    pdf = !!JEVUrl.isPdfUrl(url);
  } catch (err) {
    return false;
  }
  if (!pdf || await pdfBypassed(url)) return false;
  try {
    await chrome.tabs.update(tab.id, {
      url: chrome.runtime.getURL("pdf-viewer.html") + "?src=" + encodeURIComponent(url)
    });
    return true;
  } catch (err) {
    return false;
  }
}

async function maybeDuplicate(tab) {
  const url = tab.url || "";
  if (!isHttpPage(url) || isExtensionUrl(url) || isViewer(url)) return;
  const state = await readState();
  if (!JEV.featureOn(state, JEV.FEATURES.duplicateSite)) return;
  if (hasIgnored(tab.id, url)) return;
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  } catch (err) {
    return;
  }
  let original = null;
  for (const other of tabs) {
    if (!other || other.id === tab.id) continue;
    if (!isHttpPage(other.url) || isExtensionUrl(other.url) || isViewer(other.url)) continue;
    if (!samePage(other.url, url)) continue;
    if (!original || other.id < original.id) original = other;
  }
  if (!original || original.id === tab.id) return;
  const key = normalizedUrl(url);
  await sendTab(tab.id, { type: JEV.MSG.DUPLICATE, originalTabId: original.id, url: key || url });
}

async function onTabComplete(tab) {
  if (!tab || tab.id == null) return;
  if (await maybePdf(tab)) return;
  await maybeDuplicate(tab);
}

async function toggleHighlight() {
  const state = await readState();
  // The shortcut feature is its own switch. Off means the keys do nothing.
  // On means Alt+Shift+J flips post highlighting, not the other tools.
  if (!state.features[JEV.FEATURES.highlightShortcut]) return;
  state.features.highlight = !state.features.highlight;
  await chrome.storage.local.set(state);
  await paintBadge(state.enabled);
}

function handle(message, sender) {
  switch (message.type) {
    case JEV.MSG.SAVE:
      return saveReading(message);
    case JEV.MSG.COUNT:
      return countMark(message);
    case JEV.MSG.DUPLICATE_IGNORE:
      return ignoreDuplicate(message, sender);
    case JEV.MSG.DUPLICATE_CLOSE:
      return closeDuplicate(message, sender);
    case JEV.MSG.PROPOSAL:
      return takeProposal(message, sender);
    case JEV.MSG.PDF_BYPASS:
      return bypassPdf(message, sender);
    default:
      return {};
  }
}

chrome.runtime.onInstalled.addListener(() => {
  serial(async () => {
    const state = await readState();
    await chrome.storage.local.set(state);
    await paintBadge(state.enabled);
  }).catch(() => {});
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-highlight") return;
  serial(toggleHighlight).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return;
  serial(() => handle(message, sender)).then(
    (result) => sendResponse(result || {}),
    () => sendResponse(message.type === JEV.MSG.PROPOSAL ? { waiting: true } : {})
  );
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!info || info.status !== "complete") return;
  serial(() => onTabComplete(tab || { id: tabId })).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  ignoredDupes.delete(tabId);
  proposals.delete(tabId);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.enabled) return;
  paintBadge(changes.enabled.newValue === true).catch(() => {});
});

serial(async () => {
  const state = await readState();
  await paintBadge(state.enabled);
}).catch(() => {});
