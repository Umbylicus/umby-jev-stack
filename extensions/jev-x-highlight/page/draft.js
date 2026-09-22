(function (root) {
  "use strict";

  const WEEKDAY = "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues|tue|wed|thurs|thur|thu|fri|sat|sun)";
  const MONTH = "(?:january|february|march|april|june|july|august|september|october|november|december)";
  const MONTH_DAY = "(?:jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?";
  const DATE_RE = new RegExp(
    "\\b(?:today|tomorrow|" + WEEKDAY + "|" + MONTH + ")\\b|\\b" + MONTH_DAY + "\\b|\\b\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?\\b",
    "i"
  );
  const COMPOSE_RE = /\b(compose|reply|replies|messages?|comments?|posts?|captions?)\b/i;

  let active = false;
  let docListener = null;
  let docListening = null;
  const watched = new Set();

  function featureOn(state) {
    const id = root.JEV && root.JEV.FEATURES && root.JEV.FEATURES.draftCheck;
    return !!(id && root.JEV.featureOn && root.JEV.featureOn(state, id));
  }

  function sentencesOf(text) {
    const masked = String(text || "").replace(/(\d)\.(\d)/g, "$1\u0000$2");
    const chunks = masked.split(/\n+|(?<=[.!?])\s+/);
    const out = [];
    for (let i = 0; i < chunks.length; i++) {
      const sentence = chunks[i].replace(/\u0000/g, ".").trim();
      if (sentence) out.push(sentence);
    }
    return out;
  }

  function findPromises(text) {
    const sentences = sentencesOf(text);
    const found = [];
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (/\$\s*\d|\bdollars?\b/i.test(sentence)) found.push({ sentence: sentence, kind: "price" });
      if (DATE_RE.test(sentence)) found.push({ sentence: sentence, kind: "date" });
      if (/\brefund(?:ed|s|ing)?\b|\bmoney\s+back\b/i.test(sentence)) found.push({ sentence: sentence, kind: "refund" });
    }
    return found;
  }

  function hint(el) {
    const parts = [
      el.getAttribute && el.getAttribute("placeholder"),
      el.getAttribute && el.getAttribute("aria-label"),
      el.getAttribute && el.getAttribute("name"),
      el.getAttribute && el.getAttribute("title")
    ];
    const id = el.getAttribute && el.getAttribute("id");
    const doc = el.ownerDocument;
    if (id && doc && doc.querySelectorAll) {
      const labels = doc.querySelectorAll("label");
      for (let i = 0; i < labels.length; i++) {
        if (labels[i].getAttribute("for") === id) parts.push(labels[i].textContent || "");
      }
    }
    if (el.parentElement && el.parentElement.tagName === "LABEL") parts.push(el.parentElement.textContent || "");
    return parts.join(" ");
  }

  function isCompose(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest && el.closest(".jev-card")) return false;
    const type = String(el.getAttribute && el.getAttribute("type") || "").toLowerCase();
    const role = String(el.getAttribute && el.getAttribute("role") || "").toLowerCase();
    if (type === "password" || type === "email" || type === "hidden") return false;
    const text = hint(el);
    if (type === "search" || role === "searchbox" || /\bsearch\b/i.test(text)) return false;
    if (el.tagName === "TEXTAREA") return true;
    const editable = el.getAttribute && el.getAttribute("contenteditable");
    if (editable === "" || editable === "true" || editable === "plaintext-only") return true;
    if (el.tagName === "INPUT") {
      if (type && type !== "text") return false;
      return COMPOSE_RE.test(text);
    }
    return false;
  }

  function readCompose(el) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
    return el.textContent || "";
  }

  function textNodes(el, out) {
    const children = el.childNodes || [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.nodeType === 3) out.push(child);
      else if (child.nodeType === 1 && child.tagName !== "SCRIPT" && child.tagName !== "STYLE") textNodes(child, out);
    }
  }

  function rangesFor(el, promises) {
    const doc = el.ownerDocument;
    if (!doc || typeof doc.createRange !== "function") return [];
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return [];
    const nodes = [];
    textNodes(el, nodes);
    if (!nodes.length) return [];
    let full = "";
    const index = [];
    for (let i = 0; i < nodes.length; i++) {
      index.push({ node: nodes[i], start: full.length });
      full += nodes[i].nodeValue || "";
    }
    const wanted = [];
    const seen = new Set();
    for (let i = 0; i < promises.length; i++) {
      if (seen.has(promises[i].sentence)) continue;
      seen.add(promises[i].sentence);
      wanted.push(promises[i].sentence);
    }
    const ranges = [];
    for (let i = 0; i < wanted.length; i++) {
      const at = full.indexOf(wanted[i]);
      if (at < 0) continue;
      const end = at + wanted[i].length;
      for (let n = 0; n < index.length; n++) {
        const nodeEnd = index[n].start + String(index[n].node.nodeValue || "").length;
        const start = Math.max(at, index[n].start);
        const stop = Math.min(end, nodeEnd);
        if (start >= stop) continue;
        const range = doc.createRange();
        range.setStart(index[n].node, start - index[n].start);
        range.setEnd(index[n].node, stop - index[n].start);
        ranges.push(range);
      }
    }
    return ranges;
  }

  function clearHighlight() {
    const css = root.CSS;
    if (css && css.highlights && typeof css.highlights.delete === "function") css.highlights.delete("jev-draft");
  }

  function removeNote(doc) {
    const note = doc.getElementById && doc.getElementById("jev-draft-note");
    if (note) note.remove();
  }

  function showNote(doc, promises) {
    if (!doc.body) return;
    let note = doc.getElementById("jev-draft-note");
    if (!note) {
      note = doc.createElement("div");
      note.id = "jev-draft-note";
      note.className = "jev-draft-note";
      note.setAttribute("style", "position:fixed;z-index:2147483646;left:16px;top:16px;max-width:280px;padding:8px 10px;border-radius:10px;background:#fbf8f3;color:#1d1a16;border:1px solid #e3d9cc;font:13px/1.4 sans-serif;");
      doc.body.append(note);
    }
    const kinds = [];
    for (let i = 0; i < promises.length; i++) {
      if (kinds.indexOf(promises[i].kind) < 0) kinds.push(promises[i].kind);
    }
    note.textContent = "Draft check: " + kinds.join(", ") + ".";
  }

  function paintHighlight(ranges) {
    const css = root.CSS;
    const HighlightCtor = root.Highlight;
    if (!ranges.length || !css || !css.highlights || typeof css.highlights.set !== "function" || typeof HighlightCtor !== "function") return false;
    try {
      css.highlights.set("jev-draft", new HighlightCtor(...ranges));
      return true;
    } catch (err) {
      return false;
    }
  }

  function eachCompose(doc, visit) {
    if (!doc.querySelectorAll) return;
    const nodes = doc.querySelectorAll("textarea, input, [contenteditable]");
    for (let i = 0; i < nodes.length; i++) {
      if (isCompose(nodes[i])) visit(nodes[i]);
    }
  }

  function composeFrom(node) {
    let el = node && node.nodeType === 3 ? node.parentElement : node;
    while (el && el.nodeType === 1) {
      if (isCompose(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function unwatch() {
    watched.forEach(function (el) {
      if (el && el._jevDraftInput && el.removeEventListener) el.removeEventListener("input", el._jevDraftInput);
      if (el) el._jevDraftInput = null;
    });
    watched.clear();
  }

  function unbindDoc() {
    if (docListening && docListener && docListening.removeEventListener) {
      docListening.removeEventListener("input", docListener, true);
    }
    if (docListening && docListening.documentElement && docListener) {
      docListening.documentElement.removeEventListener("input", docListener, true);
    }
    docListener = null;
    docListening = null;
  }

  function bindDoc(doc) {
    if (docListening === doc) return;
    unbindDoc();
    docListener = function (event) {
      if (!active) return;
      if (!composeFrom(event && event.target)) return;
      refreshAll(doc);
    };
    doc.addEventListener("input", docListener, true);
    docListening = doc;
  }

  function refreshAll(doc) {
    unwatch();
    const promises = [];
    const ranges = [];
    let needsNote = false;
    eachCompose(doc, function (el) {
      const found = findPromises(readCompose(el));
      const handler = function () {
        if (!active) return;
        refreshAll(el.ownerDocument || doc);
      };
      el._jevDraftInput = handler;
      el.addEventListener("input", handler);
      watched.add(el);
      if (!found.length) return;
      const made = rangesFor(el, found);
      if (made.length) ranges.push.apply(ranges, made);
      else needsNote = true;
      promises.push.apply(promises, found);
    });
    const painted = paintHighlight(ranges);
    if (!painted) clearHighlight();
    if (promises.length && (!painted || needsNote)) showNote(doc, promises);
    else removeNote(doc);
  }

  function clearUi(doc) {
    clearHighlight();
    removeNote(doc);
  }

  function sync(state) {
    const doc = root.document;
    if (!doc) return;
    if (!featureOn(state)) {
      active = false;
      unwatch();
      unbindDoc();
      clearUi(doc);
      return;
    }
    active = true;
    bindDoc(doc);
    refreshAll(doc);
  }

  const api = { findPromises: findPromises, sync: sync, isCompose: isCompose };
  root.JEVDraft = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
