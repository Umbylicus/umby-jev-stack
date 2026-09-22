(function (root) {
  "use strict";

  const CARD_ID = "jev-checkout-card";
  const SENTENCE = "This pay page does not match the brand in the header.";

  function featureOn(state) {
    const id = root.JEV && root.JEV.FEATURES && root.JEV.FEATURES.checkoutDomain;
    return !!(id && root.JEV.featureOn && root.JEV.featureOn(state, id));
  }

  function isPayPage(page) {
    const href = String(page && page.href || "").toLowerCase();
    const text = String(page && page.text || "").toLowerCase();
    if (/\/(?:checkout|checkouts|payment|payments|pay)(?:\/|$|\?|#)/.test(href)) return true;
    if (/[?&](?:checkout|payment)=/.test(href)) return true;
    if (/\b(?:checkout|payment)\b/.test(text) || /\bpay\s+now\b/.test(text)) return true;
    return false;
  }

  function metaContent(doc, key) {
    if (!doc.querySelectorAll) return "";
    const metas = doc.querySelectorAll("meta");
    for (let i = 0; i < metas.length; i++) {
      const prop = String(metas[i].getAttribute("property") || metas[i].getAttribute("name") || "").toLowerCase();
      if (prop === key) return String(metas[i].getAttribute("content") || "").trim();
    }
    return "";
  }

  function compact(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function genericBrand(value) {
    const key = compact(value);
    return key === "checkout" || key === "securecheckout" || key === "payment" || key === "payments" ||
      key === "pay" || key === "paynow" || key === "cart" || key === "shop" || key === "store" ||
      key === "home" || key === "welcome" || key === "login" || key === "signin" || key === "account";
  }

  function brandFrom(doc) {
    if (!doc || !doc.querySelector) return "";
    const named = metaContent(doc, "og:site_name");
    if (named && !genericBrand(named)) return named;
    const images = doc.querySelectorAll("header img, [role=\"banner\"] img");
    for (let i = 0; i < images.length; i++) {
      const alt = String(images[i].getAttribute("alt") || "").trim();
      if (alt && !genericBrand(alt)) return alt;
    }
    const headings = doc.querySelectorAll("header h1, header h2, [role=\"banner\"] h1, [role=\"banner\"] h2");
    for (let i = 0; i < headings.length; i++) {
      const text = String(headings[i].textContent || "").trim();
      if (text && !genericBrand(text)) return text;
    }
    return "";
  }

  function cleanHost(hostname) {
    let host = String(hostname || "").trim().toLowerCase();
    if (!host || host.charAt(0) === "[") return host;
    host = host.replace(/:\d+$/, "");
    if (host.indexOf("www.") === 0) host = host.slice(4);
    return host;
  }

  function registrableLabel(hostname) {
    const labels = cleanHost(hostname).split(".").filter(Boolean);
    if (!labels.length) return "";
    const last = labels[labels.length - 1];
    const prev = labels[labels.length - 2];
    const shared = { co: 1, com: 1, net: 1, org: 1, ac: 1, gov: 1 };
    if (labels.length >= 3 && last.length === 2 && shared[prev]) return labels[labels.length - 3];
    if (labels.length >= 2) return labels[labels.length - 2];
    return labels[0];
  }

  function mismatches(brand, hostname) {
    const brandKey = compact(brand);
    const hostKey = compact(registrableLabel(hostname));
    if (!brandKey || brandKey.length < 3 || !hostKey || genericBrand(brand)) return false;
    if (hostKey === brandKey) return false;
    if (brandKey.indexOf(hostKey) === 0 && hostKey.length >= 4) return false;
    return true;
  }

  function pageParts(doc) {
    const loc = (doc && doc.location) || root.location || {};
    let href = loc.href || "";
    let hostname = loc.hostname || "";
    if (!hostname && href) {
      try {
        hostname = new URL(href).hostname;
      } catch (err) {
        hostname = "";
      }
    }
    return { href: href, hostname: hostname };
  }

  function removeCard(doc) {
    const card = doc.getElementById && doc.getElementById(CARD_ID);
    if (card) card.remove();
  }

  function showCard(doc) {
    if (!doc.body) return;
    let card = doc.getElementById(CARD_ID);
    if (!card) {
      card = doc.createElement("div");
      card.id = CARD_ID;
      card.className = "jev-card";
      const paragraph = doc.createElement("p");
      paragraph.textContent = SENTENCE;
      card.append(paragraph);
      doc.body.append(card);
    }
  }

  function sync(state) {
    const doc = root.document;
    if (!doc) return;
    if (!featureOn(state)) {
      removeCard(doc);
      return;
    }
    const parts = pageParts(doc);
    const text = doc.body ? doc.body.textContent : "";
    if (!isPayPage({ href: parts.href, text: text })) {
      removeCard(doc);
      return;
    }
    const brand = brandFrom(doc);
    if (!mismatches(brand, parts.hostname)) {
      removeCard(doc);
      return;
    }
    showCard(doc);
  }

  const api = {
    isPayPage: isPayPage,
    brandFrom: brandFrom,
    mismatches: mismatches,
    sync: sync
  };
  root.JEVCheckout = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
