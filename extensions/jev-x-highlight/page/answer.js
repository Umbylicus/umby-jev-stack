(function (root) {
  "use strict";

  const CARD_ID = "jev-answer-card";
  const NONE = "No section matches that question.";
  const STOP = {
    a: true, an: true, the: true, of: true, to: true, and: true, or: true, for: true,
    in: true, on: true, at: true, by: true, with: true, from: true, into: true, is: true,
    are: true, was: true, were: true, be: true, been: true, being: true, this: true,
    that: true, those: true, these: true, it: true, its: true, as: true, if: true,
    then: true, than: true, so: true, not: true, no: true, yes: true, you: true,
    your: true, we: true, our: true, they: true, their: true, i: true, me: true,
    my: true, do: true, does: true, did: true, how: true, what: true, when: true,
    where: true, which: true, who: true, whom: true, why: true, will: true, just: true,
    about: true, over: true, under: true, again: true, please: true, can: true,
    could: true, would: true, should: true, there: true, here: true, am: true
  };

  function featureOn(state) {
    const id = root.JEV && root.JEV.FEATURES && root.JEV.FEATURES.answerJump;
    return !!(id && root.JEV.featureOn && root.JEV.featureOn(state, id));
  }

  function tokens(text) {
    const words = String(text || "").toLowerCase().match(/[a-z0-9]+/g) || [];
    const out = [];
    for (let i = 0; i < words.length; i++) {
      if (words[i].length > 2 && !STOP[words[i]]) out.push(words[i]);
    }
    return out;
  }

  function sectionText(section) {
    if (typeof section === "string") return section;
    if (!section) return "";
    return [section.title, section.heading, section.text, section.body].filter(Boolean).join(" ");
  }

  function bestSection(question, sections) {
    const wanted = tokens(question);
    if (!wanted.length || !sections || !sections.length) return null;
    let best = null;
    for (let i = 0; i < sections.length; i++) {
      const words = tokens(sectionText(sections[i]));
      if (!words.length) continue;
      const have = new Set(words);
      let overlap = 0;
      for (let w = 0; w < wanted.length; w++) {
        if (have.has(wanted[w])) overlap += 1;
      }
      const score = overlap / wanted.length;
      if (!best || score > best.score) best = { index: i, score: score };
    }
    if (!best || best.score < 0.34) return null;
    return best;
  }

  function bodyAfter(heading) {
    const parent = heading.parentNode;
    if (!parent) return "";
    const nodes = parent.childNodes;
    let start = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i] === heading) {
        start = i;
        break;
      }
    }
    if (start < 0) return "";
    let text = "";
    for (let i = start + 1; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.nodeType === 1 && /^H[1-6]$/.test(node.tagName)) break;
      text += node.textContent || "";
    }
    return text;
  }

  function collect(doc) {
    if (!doc.querySelectorAll) return [];
    const heads = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const sections = [];
    for (let i = 0; i < heads.length; i++) {
      sections.push({
        title: heads[i].textContent || "",
        body: bodyAfter(heads[i]),
        el: heads[i]
      });
    }
    return sections;
  }

  function removeCard(doc) {
    const card = doc.getElementById && doc.getElementById(CARD_ID);
    if (card) card.remove();
  }

  function ensureCard(doc) {
    if (!doc.body || !doc.getElementById) return null;
    let card = doc.getElementById(CARD_ID);
    if (card) return card;
    card = doc.createElement("div");
    card.id = CARD_ID;
    card.className = "jev-card";
    const field = doc.createElement("input");
    field.id = "jev-answer-q";
    field.setAttribute("type", "text");
    field.setAttribute("aria-label", "Question");
    const row = doc.createElement("div");
    row.className = "jev-row";
    const button = doc.createElement("button");
    button.setAttribute("type", "button");
    button.textContent = "Show section";
    const status = doc.createElement("p");
    button.addEventListener("click", function () {
      const sections = collect(doc);
      const match = bestSection(field.value || "", sections);
      if (!match) {
        status.textContent = NONE;
        return;
      }
      status.textContent = "";
      const target = sections[match.index] && sections[match.index].el;
      if (target && typeof target.scrollIntoView === "function") target.scrollIntoView({ block: "start" });
    });
    row.append(button);
    card.append(field, row, status);
    doc.body.append(card);
    return card;
  }

  function sync(state) {
    const doc = root.document;
    if (!doc) return;
    if (!featureOn(state)) {
      removeCard(doc);
      return;
    }
    ensureCard(doc);
  }

  const api = { bestSection: bestSection, bodyAfter: bodyAfter, sync: sync };
  root.JEVAnswer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
