(function (root) {
  "use strict";

  function featureOn(state) {
    const id = root.JEV && root.JEV.FEATURES && root.JEV.FEATURES.stepsOnly;
    return !!(id && root.JEV.featureOn && root.JEV.featureOn(state, id));
  }

  function directItems(list, tag) {
    const out = [];
    const children = list.children || [];
    for (let i = 0; i < children.length; i++) {
      if (children[i].tagName === tag) out.push(children[i]);
    }
    return out;
  }

  function findAnchor(doc) {
    if (!doc.querySelectorAll) return null;
    const lists = doc.querySelectorAll("ol");
    for (let i = 0; i < lists.length; i++) {
      if (directItems(lists[i], "LI").length >= 3) return lists[i];
    }
    const heads = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const steps = [];
    for (let i = 0; i < heads.length; i++) {
      if (/^\s*step\s+\d+\b/i.test(heads[i].textContent || "")) steps.push(heads[i]);
    }
    if (steps.length >= 2) return steps[0];
    return null;
  }

  function restore(doc) {
    if (!doc.querySelectorAll) return;
    const blocks = doc.querySelectorAll("details.jev-steps-intro");
    for (let i = 0; i < blocks.length; i++) {
      const details = blocks[i];
      const parent = details.parentNode;
      if (!parent) continue;
      const inner = Array.from(details.childNodes);
      for (let j = 0; j < inner.length; j++) {
        const node = inner[j];
        if (node.nodeType === 1 && node.tagName === "SUMMARY") continue;
        parent.insertBefore(node, details);
      }
      details.remove();
    }
  }

  function collapse(anchor) {
    const parent = anchor.parentNode;
    if (!parent) return;
    const prior = [];
    const kids = Array.from(parent.childNodes);
    for (let i = 0; i < kids.length; i++) {
      if (kids[i] === anchor) break;
      prior.push(kids[i]);
    }
    if (
      prior.length === 1 &&
      prior[0].nodeType === 1 &&
      prior[0].classList &&
      prior[0].classList.contains("jev-steps-intro")
    ) return;
    let essay = false;
    for (let i = 0; i < prior.length; i++) {
      const node = prior[i];
      if (node.nodeType === 3 && String(node.nodeValue || "").trim()) essay = true;
      if (node.nodeType === 1 && !(node.classList && node.classList.contains("jev-steps-intro"))) essay = true;
    }
    if (!essay) return;
    const doc = anchor.ownerDocument;
    const details = doc.createElement("details");
    details.className = "jev-steps-intro";
    const summary = doc.createElement("summary");
    summary.textContent = "Show the introduction";
    details.append(summary);
    parent.insertBefore(details, anchor);
    for (let i = 0; i < prior.length; i++) details.append(prior[i]);
  }

  function sync(state) {
    const doc = root.document;
    if (!doc) return;
    if (!featureOn(state)) {
      restore(doc);
      return;
    }
    const anchor = findAnchor(doc);
    if (!anchor) {
      restore(doc);
      return;
    }
    collapse(anchor);
  }

  const api = { sync: sync, collapse: collapse, restore: restore };
  root.JEVSteps = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
