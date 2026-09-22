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
