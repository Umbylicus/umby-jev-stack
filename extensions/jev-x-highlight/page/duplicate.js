(function (root) {
  "use strict";

  const CARD_ID = "jev-duplicate-card";
  const SENTENCE = "This is already open.";

  let current = null;
  let listening = false;

  function featureOn(state) {
    const id = root.JEV && root.JEV.FEATURES && root.JEV.FEATURES.duplicateSite;
    return !!(id && root.JEV.featureOn && root.JEV.featureOn(state, id));
  }

  function messageType(name) {
    const msg = root.JEV && root.JEV.MSG;
    if (msg && msg[name]) return msg[name];
    if (name === "DUPLICATE") return "jev-duplicate";
    if (name === "DUPLICATE_CLOSE") return "jev-duplicate-close";
    return "jev-duplicate-ignore";
  }

  function send(payload) {
    const chrome = root.chrome;
    if (chrome && chrome.runtime && typeof chrome.runtime.sendMessage === "function") {
      chrome.runtime.sendMessage(payload);
    }
  }

  function removeCard(doc) {
    const card = doc && doc.getElementById && doc.getElementById(CARD_ID);
    if (card) card.remove();
  }

  function showCard(doc, originalTabId) {
    if (!doc.body) return;
    removeCard(doc);
    const card = doc.createElement("div");
    card.id = CARD_ID;
    card.className = "jev-card";
    const paragraph = doc.createElement("p");
    paragraph.textContent = SENTENCE;
    const row = doc.createElement("div");
    row.className = "jev-row";
    const close = doc.createElement("button");
    close.setAttribute("type", "button");
    close.textContent = "Close and go to original";
    close.addEventListener("click", function () {
      send({ type: messageType("DUPLICATE_CLOSE"), originalTabId: originalTabId });
    });
    const ignore = doc.createElement("button");
    ignore.setAttribute("type", "button");
    ignore.textContent = "Ignore";
    ignore.addEventListener("click", function () {
      send({ type: messageType("DUPLICATE_IGNORE") });
      removeCard(doc);
    });
    row.append(close, ignore);
    card.append(paragraph, row);
    doc.body.append(card);
  }

  function handle(message) {
    if (!message || message.type !== messageType("DUPLICATE")) return;
    const doc = root.document;
    if (!doc) return;
    if (!featureOn(current)) {
      removeCard(doc);
      return;
    }
    showCard(doc, message.originalTabId);
  }

  function ensureListener() {
    if (listening) return;
    const chrome = root.chrome;
    const onMessage = chrome && chrome.runtime && chrome.runtime.onMessage;
    if (!onMessage || typeof onMessage.addListener !== "function") return;
    onMessage.addListener(handle);
    listening = true;
  }

  function sync(state) {
    current = state;
    const doc = root.document;
    if (!doc) return;
    ensureListener();
    if (!featureOn(state)) {
      removeCard(doc);
      return;
    }
  }

  const api = { sync: sync };
  root.JEVDuplicate = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
