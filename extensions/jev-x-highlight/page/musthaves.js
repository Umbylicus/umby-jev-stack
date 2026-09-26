(function (root) {
  "use strict";

  function featureOn(state) {
    const id = root.JEV && root.JEV.FEATURES && root.JEV.FEATURES.mustHaves;
    return !!(id && root.JEV.featureOn && root.JEV.featureOn(state, id));
  }

  function parseRequirements(text) {
    return String(text || "")
      .split(/\n+/)
      .reduce(function (out, line) {
        const parts = line.split(/,(?!\d)/);
        for (let i = 0; i < parts.length; i++) {
          const item = parts[i].trim();
          if (item) out.push(item);
        }
        return out;
      }, []);
  }

  function toPounds(value, unit) {
    const name = String(unit || "").toLowerCase();
    if (name.indexOf("kg") === 0 || name.indexOf("kilo") === 0) return value * 2.20462;
    if (name.indexOf("oz") === 0 || name.indexOf("ounce") === 0) return value / 16;
    return value;
  }

  function moneyCap(requirement) {
    if (!/\b(?:under|below|less than|at most|max(?:imum)?)\b/i.test(requirement)) return null;
    const dollar = requirement.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)/);
    if (dollar) return Number(dollar[1].replace(/,/g, ""));
    const word = requirement.match(/(\d+(?:\.\d+)?)\s*dollars?\b/i);
    if (word) return Number(word[1]);
    return null;
  }

  function moneyValues(text) {
    const values = [];
    const re = /\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)|\bUSD\s*(\d+(?:,\d{3})*(?:\.\d+)?)|(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:dollars?|USD)\b/gi;
    let match;
    while ((match = re.exec(text))) {
      const raw = match[1] || match[2] || match[3];
      if (raw) values.push(Number(raw.replace(/,/g, "")));
    }
    return values;
  }

  function weightCap(requirement) {
    if (!/\b(?:under|below|less than|at most|max(?:imum)?)\b/i.test(requirement)) return null;
    const match = requirement.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|pounds?|kg|kilograms?|oz|ounces?)\b/i);
    if (!match) return null;
    return toPounds(Number(match[1]), match[2]);
  }

  function weightValues(text) {
    const values = [];
    const re = /(\d+(?:\.\d+)?)\s*(lb|lbs|pounds?|kg|kilograms?|oz|ounces?)\b/gi;
    let match;
    while ((match = re.exec(text))) values.push(toPounds(Number(match[1]), match[2]));
    return values;
  }

  function voltageTarget(requirement) {
    if (!/\d+(?:\.\d+)?\s*v(?:olts?)?\b/i.test(requirement)) return null;
    const match = requirement.match(/(\d+(?:\.\d+)?)\s*v(?:olts?)?\b/i);
    return match ? Number(match[1]) : null;
  }

  function voltageSpecs(text) {
    const specs = [];
    const re = /(\d+(?:\.\d+)?)\s*(?:-|–|—|\/|\bto\b)\s*(\d+(?:\.\d+)?)\s*v(?:olts?)?\b|(\d+(?:\.\d+)?)\s*v(?:olts?)?\b/gi;
    let match;
    while ((match = re.exec(text))) {
      if (match[1] && match[2]) {
        const lo = Number(match[1]);
        const hi = Number(match[2]);
        specs.push({ lo: Math.min(lo, hi), hi: Math.max(lo, hi) });
      } else if (match[3]) {
        const value = Number(match[3]);
        specs.push({ lo: value, hi: value });
      }
    }
    return specs;
  }

  function rowFails(requirement, rowText) {
    const req = String(requirement || "").trim();
    const row = String(rowText || "");
    if (!req || !row.trim()) return false;
    const money = moneyCap(req);
    if (money != null) {
      const amounts = moneyValues(row);
      if (amounts.some(function (amount) { return amount > money + 1e-9; })) return true;
    }
    const weight = weightCap(req);
    if (weight != null) {
      const weights = weightValues(row);
      if (weights.some(function (pounds) { return pounds > weight + 1e-9; })) return true;
    }
    const volts = voltageTarget(req);
    if (volts != null) {
      const specs = voltageSpecs(row);
      if (specs.length && specs.every(function (spec) { return volts < spec.lo - 0.01 || volts > spec.hi + 0.01; })) return true;
    }
    return false;
  }

  function pageParts(doc) {
    const loc = (doc && doc.location) || root.location || {};
    return { href: loc.href || "" };
  }

  function controlLabel(el) {
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria && String(aria).trim()) return aria;
    if (el.tagName === "INPUT") return el.value || "";
    return el.textContent || "";
  }

  function isProduct(doc) {
    const href = pageParts(doc).href;
    let path = href;
    try {
      path = new URL(href, "https://jev.invalid").pathname;
    } catch (err) {
      path = href;
    }
    if (/\/product(?:\/|$)/i.test(path) || /\/dp(?:\/|$)/i.test(path)) return true;
    if (!doc.querySelectorAll) return false;
    const metas = doc.querySelectorAll("meta");
    for (let i = 0; i < metas.length; i++) {
      const prop = String(metas[i].getAttribute("property") || metas[i].getAttribute("name") || "").toLowerCase();
      if (prop === "og:type" && /product/i.test(metas[i].getAttribute("content") || "")) return true;
    }
    const controls = doc.querySelectorAll("button, a, input, [role=\"button\"]");
    for (let i = 0; i < controls.length; i++) {
      if (/add to cart/i.test(controlLabel(controls[i]))) return true;
    }
    return false;
  }

  function rowText(el) {
    if (el.tagName === "DD" && el.parentElement) {
      let prev = el.previousElementSibling || null;
      if (!prev) {
        const siblings = el.parentElement.children || [];
        for (let i = 0; i < siblings.length; i++) {
          if (siblings[i] === el) {
            prev = i > 0 ? siblings[i - 1] : null;
            break;
          }
        }
      }
      const label = prev && prev.tagName === "DT" ? prev.textContent : "";
      return (label + " " + (el.textContent || "")).trim();
    }
    return el.textContent || "";
  }

  function specRows(doc) {
    if (!doc.querySelectorAll) return [];
    const nodes = doc.querySelectorAll("tr, li, dl div, dd");
    const rows = [];
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el.tagName === "DIV" && (!el.parentElement || el.parentElement.tagName !== "DL")) continue;
      if (el.querySelector && el.querySelector("tr, li, dd")) continue;
      rows.push(el);
    }
    return rows;
  }

  function clearMarks(doc) {
    if (!doc.querySelectorAll) return;
    const marked = doc.querySelectorAll("[data-jev-must]");
    for (let i = 0; i < marked.length; i++) {
      marked[i].removeAttribute("data-jev-must");
      if (!marked[i].hasAttribute("data-jev-job")) marked[i].classList.remove("jev-fail");
    }
  }

  function sync(state) {
    const doc = root.document;
    if (!doc) return;
    clearMarks(doc);
    if (!featureOn(state)) return;
    if (!isProduct(doc)) return;
    const requirements = parseRequirements(state && state.mustHaveText);
    if (!requirements.length) return;
    const rows = specRows(doc);
    for (let i = 0; i < rows.length; i++) {
      const text = rowText(rows[i]);
      let failed = false;
      for (let r = 0; r < requirements.length; r++) {
        if (rowFails(requirements[r], text)) failed = true;
      }
      if (!failed) continue;
      rows[i].classList.add("jev-fail");
      rows[i].setAttribute("data-jev-must", "1");
    }
  }

  const api = { parseRequirements: parseRequirements, rowFails: rowFails, rowText: rowText, sync: sync };
  root.JEVMust = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
