(function (root) {
  "use strict";

  const CARD_ID = "jev-decision-card";
  const STOP = {
    i: true, the: true, a: true, an: true, this: true, that: true, if: true, we: true,
    you: true, they: true, he: true, she: true, it: true, on: true, in: true, please: true,
    when: true, then: true, and: true, but: true, or: true, for: true, to: true, of: true,
    my: true, our: true, today: true, tomorrow: true, monday: true, tuesday: true,
    wednesday: true, thursday: true, friday: true, saturday: true, sunday: true
  };
  const DATE_WORD = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  const MONTH_DATE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/i;
  const NUMERIC_DATE = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/;

  let active = false;
  let mouseHandler = null;

  function featureOn(state) {
    const id = root.JEV && root.JEV.FEATURES && root.JEV.FEATURES.decisionLine;
    return !!(id && root.JEV.featureOn && root.JEV.featureOn(state, id));
  }

  function findOwner(text) {
    const byName = text.match(/\bby\s+([A-Z][a-z]+)\b/);
    if (byName && !STOP[byName[1].toLowerCase()]) return byName[1];
    const willName = text.match(/\b([A-Z][a-z]+)\s+will\b/);
    if (willName && !STOP[willName[1].toLowerCase()]) return willName[1];
    const first = text.match(/^([A-Z][a-z]+)\b/);
    if (first && !STOP[first[1].toLowerCase()]) return first[1];
    return "";
  }

  function findDate(text) {
    const word = text.match(DATE_WORD);
    if (word) return word[1];
    const month = text.match(MONTH_DATE);
    if (month) return month[0];
    const numeric = text.match(NUMERIC_DATE);
    if (numeric) return numeric[0];
    return "";
  }

  // Dates come only from the selection. `now` is not used as a fallback clock.
  function line(text, now) {
    void now;
    const flat = String(text || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    const owner = findOwner(flat) || "unknown";
    const date = findDate(flat) || "none";
    let decision = flat || "none";
    if (!/[.!?]$/.test(decision)) decision += ".";
    return "Decision: " + decision + " Owner: " + owner + ". Date: " + date + ".";
  }

  function removeCard(doc) {
    const card = doc.getElementById && doc.getElementById(CARD_ID);
    if (card) card.remove();
  }

  function fallbackCopy(text) {
    const doc = root.document;
    if (!doc || !doc.body) return;
    const area = doc.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "readonly");
    doc.body.append(area);
    if (typeof area.focus === "function") area.focus();
    if (typeof area.select === "function") area.select();
    if (typeof area.setSelectionRange === "function") area.setSelectionRange(0, text.length);
    if (typeof doc.execCommand === "function") doc.execCommand("copy");
    area.remove();
  }

  function copyText(text) {
    const nav = root.navigator;
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
      try {
        const pending = nav.clipboard.writeText(text);
        if (pending && typeof pending.catch === "function") pending.catch(function () { fallbackCopy(text); });
        return;
      } catch (err) {
        fallbackCopy(text);
        return;
      }
    }
    fallbackCopy(text);
  }

  function showCard(doc, text) {
    if (!doc.body) return;
    let card = doc.getElementById(CARD_ID);
    if (!card) {
      card = doc.createElement("div");
      card.id = CARD_ID;
      card.className = "jev-card";
      const paragraph = doc.createElement("p");
      paragraph.className = "jev-decision-line";
      const row = doc.createElement("div");
      row.className = "jev-row";
      const button = doc.createElement("button");
      button.setAttribute("type", "button");
      button.textContent = "Copy";
      button.addEventListener("click", function () {
        copyText(paragraph.textContent || "");
      });
      row.append(button);
      card.append(paragraph, row);
      doc.body.append(card);
    }
    const paragraph = card.querySelector("p");
    if (paragraph) paragraph.textContent = text;
  }

  function selectedText(doc) {
    let selection = null;
    if (typeof doc.getSelection === "function") selection = doc.getSelection();
    else if (doc.defaultView && typeof doc.defaultView.getSelection === "function") selection = doc.defaultView.getSelection();
    if (!selection) return "";
    if (typeof selection.toString === "function") return selection.toString();
    return String(selection);
  }

  function unbind(doc) {
    if (mouseHandler && doc && doc.removeEventListener) doc.removeEventListener("mouseup", mouseHandler);
    if (mouseHandler && doc && doc.documentElement && doc.documentElement.removeEventListener) {
      doc.documentElement.removeEventListener("mouseup", mouseHandler);
    }
    mouseHandler = null;
  }

  function bind(doc) {
    if (mouseHandler) return;
    mouseHandler = function (event) {
      if (!active) return;
      const target = event && event.target;
      if (target && target.closest && target.closest("#" + CARD_ID)) return;
      const text = selectedText(doc);
      if (!text || !text.trim() || text.length < 40) return;
      showCard(doc, line(text));
    };
    doc.addEventListener("mouseup", mouseHandler);
  }

  function sync(state) {
    const doc = root.document;
    if (!doc) return;
    if (!featureOn(state)) {
      active = false;
      unbind(doc);
      removeCard(doc);
      return;
    }
    active = true;
    bind(doc);
  }

  const api = { line: line, sync: sync };
  root.JEVDecision = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
