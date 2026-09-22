(function (root) {
  "use strict";

  // Boots only when this is a real page inside the extension. Proposal diff stays pure.

  const WAITING = "Open a second proposal or contract to compare.";
  const NO_CHANGES = "No price, term, or liability changes.";
  const CHANGE_LABEL = { price: "Price", term: "Term", liability: "Liability" };

  let latestState = null;
  let listening = false;
  let watching = false;

  function featureOn(state, id) {
    return !!(root.JEV && typeof root.JEV.featureOn === "function" && root.JEV.featureOn(state, id));
  }

  function pageContext() {
    const doc = root.document;
    if (!doc) return { href: "", title: "", heading: "" };
    const loc = doc.location || root.location || "";
    const href = typeof loc === "string" ? loc : (loc && loc.href) || doc.URL || "";
    const title = doc.title || "";
    let heading = "";
    if (typeof doc.querySelector === "function") {
      const h1 = doc.querySelector("h1");
      if (h1) heading = h1.innerText || h1.textContent || "";
    }
    return { href, title, heading };
  }

  function isProposalPage(ctx) {
    const blob = [ctx.href, ctx.title, ctx.heading].join(" ").toLowerCase().replace(/[-_/]+/g, " ");
    return /\bproposal\b|\bcontract\b|\bagreement\b|\bquote\b|statement of work/.test(blob);
  }

  function removeProposalCard() {
    const doc = root.document;
    const card = doc && doc.getElementById && doc.getElementById("jev-proposal");
    if (card) card.remove();
  }

  function render(message) {
    const doc = root.document;
    if (!doc || !doc.body) return;
    removeProposalCard();
    const data = message || {};
    const card = doc.createElement("section");
    card.id = "jev-proposal";
    card.className = "jev-card";
    card.setAttribute("data-jev-card", "proposal");
    card.setAttribute("aria-label", "Proposal");
    card.style.right = "16px";
    card.style.top = "16px";
    card.style.bottom = "auto";
    if (data.waiting === true) {
      card.textContent = WAITING;
      doc.body.appendChild(card);
      return;
    }
    const diffs = (Array.isArray(data.diffs) ? data.diffs : []).filter((diff) => {
      return diff && (diff.change === "price" || diff.change === "term" || diff.change === "liability");
    });
    if (!diffs.length) {
      card.textContent = NO_CHANGES;
      doc.body.appendChild(card);
      return;
    }
    const title = doc.createElement("h2");
    title.textContent = "Proposal";
    card.appendChild(title);
    for (const diff of diffs) {
      const heading = doc.createElement("h3");
      heading.textContent = diff.heading || CHANGE_LABEL[diff.change];
      const body = doc.createElement("p");
      body.textContent = CHANGE_LABEL[diff.change] + ": " + (diff.before || "") + " → " + (diff.after || "");
      card.appendChild(heading);
      card.appendChild(body);
    }
    doc.body.appendChild(card);
  }

  function pageText(doc) {
    if (!doc || !doc.body) return "";
    const cards = typeof doc.querySelectorAll === "function" ? [...doc.querySelectorAll(".jev-card")] : [];
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

  function payload() {
    const doc = root.document;
    const ctx = pageContext();
    return {
      type: root.JEV.MSG.PROPOSAL,
      text: pageText(doc),
      title: ctx.title,
      href: ctx.href
    };
  }

  function deliverResponse(response, runtime) {
    if (!featureOn(latestState, "proposalDiff") || !isProposalPage(pageContext())) {
      removeProposalCard();
      return;
    }
    if (runtime && runtime.lastError) {
      render({ waiting: true });
      return;
    }
    render(response || { waiting: true });
  }

  function sync(state, preset) {
    latestState = state || latestState;
    if (!featureOn(state, "proposalDiff") || !isProposalPage(pageContext())) {
      removeProposalCard();
      return;
    }
    if (preset) {
      render(preset);
      return;
    }
    const message = payload();
    const runtime = root.chrome && root.chrome.runtime;
    if (!runtime || typeof runtime.sendMessage !== "function") {
      render({ waiting: true });
      return;
    }
    render({ waiting: true });
    try {
      runtime.sendMessage(message, (response) => deliverResponse(response, runtime));
    } catch (err) {
      try {
        const pending = runtime.sendMessage(message);
        if (pending && typeof pending.then === "function") {
          pending.then((response) => deliverResponse(response, runtime)).catch(() => render({ waiting: true }));
          return;
        }
      } catch (err2) {
        render({ waiting: true });
      }
    }
  }

  function onRuntimeMessage(message) {
    if (!message || !root.JEV || message.type !== root.JEV.MSG.PROPOSAL_DIFF) return;
    if (!featureOn(latestState, "proposalDiff") || !isProposalPage(pageContext())) return;
    render(message);
  }

  function attach() {
    const pure = root.JEVProposal || {};
    root.JEVProposal = Object.assign({}, pure, { sync, render });
  }

  function boot() {
    attach();
    const runtime = root.chrome && root.chrome.runtime;
    if (!root.document || !runtime || !runtime.id) return;
    if (!listening && runtime.onMessage && typeof runtime.onMessage.addListener === "function") {
      runtime.onMessage.addListener(onRuntimeMessage);
      listening = true;
    }
    if (!watching && root.JEV && typeof root.JEV.watchState === "function") {
      watching = true;
      root.JEV.watchState((state) => {
        if (root.JEVTerms && typeof root.JEVTerms.sync === "function") root.JEVTerms.sync(state);
        sync(state);
        if (root.JEVFill && typeof root.JEVFill.sync === "function") root.JEVFill.sync(state);
      });
    }
  }

  attach();
  boot();

  const api = { boot };
  root.JEVDocs = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
