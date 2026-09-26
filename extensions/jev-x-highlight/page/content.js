(function (root) {
  "use strict";

  const NAMES = [
    "JEVDraft",
    "JEVCheckout",
    "JEVSteps",
    "JEVCookies",
    "JEVDecision",
    "JEVMust",
    "JEVPdf",
    "JEVJob",
    "JEVCancel",
    "JEVAnswer",
    "JEVDuplicate"
  ];

  let started = false;

  function isMailHost(hostname) {
    const host = String(hostname || "").toLowerCase().replace(/^www\./, "");
    if (!host) return false;
    if (host === "mail.google.com" || host.endsWith(".mail.google.com") || host === "gmail.com") return true;
    if (root.JEV && typeof root.JEV.siteId === "function") {
      const site = root.JEV.siteId(host);
      if (site === "gmail" || site === "outlook") return true;
    }
    if (host === "outlook.live.com" || host.endsWith(".outlook.live.com")) return true;
    if (host === "outlook.office.com" || host.endsWith(".outlook.office.com")) return true;
    if (host === "outlook.office365.com" || host.endsWith(".outlook.office365.com")) return true;
    if (host === "outlook.cloud.microsoft" || host.endsWith(".outlook.cloud.microsoft")) return true;
    return false;
  }

  function syncAll(state) {
    for (let i = 0; i < NAMES.length; i++) {
      const tool = root[NAMES[i]];
      if (!tool || typeof tool.sync !== "function") continue;
      try {
        tool.sync(state);
      } catch (err) {
        // One tool must not stop the others.
      }
    }
    const ask = root.JEVAsk;
    const body = root.document && root.document.body;
    const hostname = root.location && root.location.hostname;
    // Mail rows stay in place. Do not score or rewrite Gmail or Outlook from here.
    if (!ask || typeof ask.eachFeature !== "function" || !body || isMailHost(hostname)) return;
    try {
      ask.eachFeature(state, body.innerText || "");
    } catch (err) {
      // Ask must not stop the tools.
    }
  }

  function boot() {
    if (!root.document) return;
    const runtime = root.chrome && root.chrome.runtime;
    if (!runtime || !runtime.id) return;
    if (!root.JEV || typeof root.JEV.watchState !== "function") return;
    if (started) return;
    started = true;
    root.JEV.watchState(syncAll);
  }

  const api = { boot: boot, syncAll: syncAll };
  root.JEVPage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (root.document && root.chrome && root.chrome.runtime && root.chrome.runtime.id) boot();
})(typeof globalThis !== "undefined" ? globalThis : this);
