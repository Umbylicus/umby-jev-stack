(function (root) {
  "use strict";

  const TOPICS = [
    ["Auto-renew", "autoRenew"],
    ["Cancellation window", "cancellation"],
    ["Arbitration", "arbitration"],
    ["Data sold", "dataSold"]
  ];

  function featureOn(state, id) {
    return !!(root.JEV && typeof root.JEV.featureOn === "function" && root.JEV.featureOn(state, id));
  }

  function pageBlob(parts) {
    return parts.map((part) => String(part || "")).join(" ").toLowerCase().replace(/[-_/]+/g, " ");
  }

  function isPolicyLabel(label) {
    if (/\bterms of (?:service|use)\b|\bterms and conditions\b|\bprivacy (?:policy|notice|statement)\b|\bcookie policy\b|\blegal notice\b/.test(label)) {
      return true;
    }
    const parts = label.split(/[|·•:]+/);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (/^(terms|privacy|tos|eula|terms of service|terms of use|terms and conditions|privacy policy|privacy notice|cookie policy|legal notice)$/.test(part)) {
        return true;
      }
    }
    return false;
  }

  function isTermsPage(page) {
    const src = page || {};
    const href = pageBlob([String(src.href || "").split("#")[0].split("?")[0]]);
    if (/\bterms\b|\bprivacy\b|\bprivacypolicy\b|\btermsofservice\b|\btermsofuse\b|\btermsandconditions\b|\bcookie policy\b|\bcookiepolicy\b|\blegal notice\b|\blegalnotice\b|\btos\b|\beula\b/.test(href)) {
      return true;
    }
    return isPolicyLabel(pageBlob([src.title, src.heading]));
  }

  function sentences(text) {
    const source = String(text || "").replace(/\r\n/g, "\n");
    const found = [];
    const pattern = /[^.!?\n]+(?:[.!?]+|$)/g;
    let match;
    while ((match = pattern.exec(source))) {
      const sentence = match[0].replace(/\s+/g, " ").trim();
      if (sentence) found.push(sentence);
    }
    return found;
  }

  function matchesTopic(key, sentence) {
    const text = sentence.toLowerCase();
    if (key === "autoRenew") {
      return /auto[-\s]?renew|automatic(?:ally)?\s+renew|renews?\s+automatically/.test(text);
    }
    if (key === "cancellation") {
      if (/\bcancel\w*(?:\s+\w+){0,8}\swithin\b|\bcancellation\s+(?:window|period)\b|\bcancel(?:lation)?\s+within\b/.test(text)) return true;
      if (/\b\d+\s*-?\s*days?\s+to\s+cancel\b|\bdays?'?\s+notice\b|\bnotice period\b/.test(text)) return true;
      if (/\bcancel\w*\b[\s\S]{0,40}\b\d+\s*-?\s*days?\b/.test(text)) return true;
      return /\b\d+\s*-?\s*days?\b[\s\S]{0,40}\bcancel/.test(text);
    }
    if (key === "arbitration") {
      return /\barbitration\b|\bwaiv\w*(?:\s+\w+){0,8}\s+jury\b|\bjury\b(?:\s+\w+){0,8}\s+waiv/.test(text);
    }
    if (key !== "dataSold") return false;
    if (/sell(?:s|ing)?\s+(?:your\s+)?(?:personal\s+)?(?:data|information)\b/.test(text)) return true;
    if (/sale of\s+(?:your\s+)?personal\s+(?:data|information)\b/.test(text)) return true;
    if (/\bthird parties\b/.test(text) && /\bfor sale\b/.test(text)) return true;
    if (/\bsold\b/.test(text) && /\b(personal data|personal information|data|information|privacy)\b/.test(text)) return true;
    return false;
  }

  function clipBucket(matches) {
    const picked = [];
    let used = 0;
    for (const sentence of matches) {
      if (picked.length >= 2 || used >= 240) break;
      const room = 240 - used;
      const next = sentence.length > room ? sentence.slice(0, room).trim() : sentence;
      if (!next) break;
      picked.push(next);
      used += next.length + 1;
    }
    return picked;
  }

  function extract(text) {
    const lines = sentences(text);
    const buckets = { autoRenew: [], cancellation: [], arbitration: [], dataSold: [] };
    for (const key of Object.keys(buckets)) {
      const matches = [];
      for (const sentence of lines) {
        if (matchesTopic(key, sentence) && !matches.includes(sentence)) matches.push(sentence);
      }
      buckets[key] = clipBucket(matches);
    }
    return buckets;
  }

  function readPage(doc) {
    const loc = doc.location || root.location || "";
    const href = typeof loc === "string" ? loc : (loc && loc.href) || "";
    const title = doc.title || "";
    const h1 = typeof doc.querySelector === "function" ? doc.querySelector("h1") : null;
    const heading = h1 ? (h1.innerText || h1.textContent || "") : "";
    return { href, title, heading };
  }

  function collectNodes(nodes) {
    const out = [];
    if (!nodes || typeof nodes.length !== "number") return out;
    for (let i = 0; i < nodes.length; i++) out.push(nodes[i]);
    return out;
  }

  function pageText(doc) {
    const cards = typeof doc.querySelectorAll === "function" ? collectNodes(doc.querySelectorAll(".jev-card")) : [];
    const spots = cards.map((card) => ({ card, parent: card.parentNode, next: card.nextSibling }));
    for (const card of cards) card.remove();
    try {
      return doc.body.innerText || doc.body.textContent || "";
    } finally {
      for (let i = spots.length - 1; i >= 0; i--) {
        const spot = spots[i];
        if (!spot.parent) continue;
        if (spot.next && spot.next.parentNode === spot.parent) spot.parent.insertBefore(spot.card, spot.next);
        else spot.parent.appendChild(spot.card);
      }
    }
  }

  function removeCard(doc) {
    const card = doc.getElementById && doc.getElementById("jev-terms");
    if (card) card.remove();
  }

  function sync(state) {
    const doc = root.document;
    if (!doc || !doc.body) return;
    if (!featureOn(state, "termsCard") || !isTermsPage(readPage(doc))) {
      removeCard(doc);
      return;
    }
    removeCard(doc);
    const found = extract(pageText(doc));
    const card = doc.createElement("section");
    card.id = "jev-terms";
    card.className = "jev-card";
    card.setAttribute("data-jev-card", "terms");
    card.setAttribute("aria-label", "Terms");
    card.style.right = "16px";
    card.style.bottom = "16px";
    const title = doc.createElement("p");
    title.textContent = "Terms";
    card.appendChild(title);
    for (const [heading, key] of TOPICS) {
      const h = doc.createElement("h3");
      h.textContent = heading;
      const body = doc.createElement("p");
      const items = found[key];
      body.textContent = items && items.length ? items.join(" ") : "None found";
      card.appendChild(h);
      card.appendChild(body);
    }
    doc.body.appendChild(card);
  }

  const api = { isTermsPage, extract, sync };
  root.JEVTerms = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
