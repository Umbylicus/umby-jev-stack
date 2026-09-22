(function (root) {
  "use strict";

  let path = [];
  let index = -1;
  let armed = null;

  function featureOn(state) {
    const id = root.JEV && root.JEV.FEATURES && root.JEV.FEATURES.helpCancel;
    return !!(id && root.JEV.featureOn && root.JEV.featureOn(state, id));
  }

  function rankControl(text) {
    const label = String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!label) return 0;
    if (/confirm cancellation|finish cancellation|yes,\s*cancel/.test(label)) return 5;
    if (/why are you leaving|\breason\b/.test(label)) return 3;
    if (/\b(?:continue|next)\b/.test(label)) return 4;
    if (/cancel subscription|end subscription|close account/.test(label)) return 2;
    if (/manage subscription|\bbilling\b|\bmembership\b/.test(label)) return 1;
    return 0;
  }

  function controlLabel(el) {
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria && String(aria).trim()) return aria;
    if (el.tagName === "INPUT") return el.value || (el.getAttribute && el.getAttribute("value")) || "";
    return el.textContent || "";
  }

  function disarm(el) {
    if (!el) return;
    el.classList.remove("jev-glow");
    el.removeAttribute("data-jev-cancel");
    if (el._jevCancelAdvance && el.removeEventListener) el.removeEventListener("click", el._jevCancelAdvance);
    el._jevCancelAdvance = null;
  }

  function clearGlow(doc) {
    disarm(armed);
    armed = null;
    index = -1;
    path = [];
    if (!doc || !doc.querySelectorAll) return;
    const marked = doc.querySelectorAll("[data-jev-cancel]");
    for (let i = 0; i < marked.length; i++) disarm(marked[i]);
  }

  function rankedControls(doc) {
    if (!doc.querySelectorAll) return [];
    const nodes = doc.querySelectorAll("a, button, input, select, textarea, [role=\"button\"]");
    const out = [];
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === "jev-help-cancel") continue;
      if (rankControl(controlLabel(nodes[i])) > 0) out.push(nodes[i]);
    }
    return out;
  }

  function showStep(doc, step) {
    if (armed) disarm(armed);
    armed = null;
    if (step < 0 || step >= path.length) {
      index = -1;
      return;
    }
    index = step;
    armed = path[step];
    armed.classList.add("jev-glow");
    armed.setAttribute("data-jev-cancel", "1");
    const handler = function () {
      showStep(doc, index + 1);
    };
    armed._jevCancelAdvance = handler;
    armed.addEventListener("click", handler);
  }

  function start(doc) {
    path = rankedControls(doc);
    if (!path.length) {
      clearGlow(doc);
      return;
    }
    showStep(doc, 0);
  }

  function removeButton(doc) {
    const button = doc.getElementById && doc.getElementById("jev-help-cancel");
    if (button) button.remove();
  }

  function ensureButton(doc) {
    if (!doc.body || !doc.getElementById) return;
    if (doc.getElementById("jev-help-cancel")) return;
    const button = doc.createElement("button");
    button.id = "jev-help-cancel";
    button.setAttribute("type", "button");
    button.textContent = "Help me cancel";
    button.addEventListener("click", function (event) {
      if (event && event.preventDefault) event.preventDefault();
      start(doc);
    });
    doc.body.append(button);
  }

  function sync(state) {
    const doc = root.document;
    if (!doc) return;
    if (!featureOn(state)) {
      clearGlow(doc);
      removeButton(doc);
      return;
    }
    ensureButton(doc);
  }

  const api = { rankControl: rankControl, sync: sync };
  root.JEVCancel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
