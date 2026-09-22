(function (root) {
  "use strict";

  const REJECT = {
    "reject all": true,
    "reject cookies": true,
    "essential only": true,
    "necessary only": true,
    "only essential": true,
    "decline all": true,
    "refuse all": true,
    "required only": true
  };

  function featureOn(state) {
    const id = root.JEV && root.JEV.FEATURES && root.JEV.FEATURES.rejectCookies;
    return !!(id && root.JEV.featureOn && root.JEV.featureOn(state, id));
  }

  function isRejectLabel(text) {
    const norm = String(text || "").replace(/\s+/g, " ").trim().toLowerCase().replace(/[.!]+$/, "");
    return REJECT[norm] === true;
  }

  function controlLabel(el) {
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria && String(aria).trim()) return aria;
    const labelled = el.getAttribute && el.getAttribute("aria-labelledby");
    if (labelled && el.ownerDocument && el.ownerDocument.getElementById) {
      const ids = String(labelled).split(/\s+/);
      const parts = [];
      for (let i = 0; i < ids.length; i++) {
        const node = el.ownerDocument.getElementById(ids[i]);
        if (node) parts.push(node.textContent || "");
      }
      if (parts.join(" ").trim()) return parts.join(" ");
    }
    if (el.tagName === "INPUT") return el.value || (el.getAttribute && el.getAttribute("value")) || "";
    return el.textContent || "";
  }

  function isTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === "BUTTON" || el.tagName === "A") return true;
    const role = String(el.getAttribute && el.getAttribute("role") || "").toLowerCase();
    if (role === "button") return true;
    if (el.tagName === "INPUT") {
      const type = String(el.getAttribute("type") || "").toLowerCase();
      return type === "button" || type === "submit";
    }
    return false;
  }

  function clearMarks(doc) {
    if (!doc.querySelectorAll) return;
    const marked = doc.querySelectorAll(".jev-reject");
    for (let i = 0; i < marked.length; i++) marked[i].classList.remove("jev-reject");
  }

  function sync(state) {
    const doc = root.document;
    if (!doc) return;
    clearMarks(doc);
    if (!featureOn(state)) return;
    if (!doc.querySelectorAll) return;
    const nodes = doc.querySelectorAll("button, a, input, [role=\"button\"]");
    for (let i = 0; i < nodes.length; i++) {
      if (!isTarget(nodes[i])) continue;
      if (isRejectLabel(controlLabel(nodes[i]))) nodes[i].classList.add("jev-reject");
    }
  }

  const api = { isRejectLabel: isRejectLabel, sync: sync };
  root.JEVCookies = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
