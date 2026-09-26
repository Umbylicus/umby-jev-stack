(function (root) {
  "use strict";

  const FOLDER_JUNK = /(?:^|[/#?=&])(?:junkemail|spam|junk)(?=$|[/#?=&])/i;
  const DEBOUNCE_MS = 200;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function cleanSnippet(value) {
    return clean(value).replace(/^[-–—]\s+/, "");
  }

  function phraseHit(text, phrases) {
    const matcher = root.JEVMatch;
    if (!matcher || typeof matcher.phraseHit !== "function") return false;
    return !!matcher.phraseHit(text, phrases);
  }

  function looksLikeSpam(text) {
    const matcher = root.JEVMatch;
    if (!matcher || typeof matcher.looksLikeSpam !== "function") return false;
    return !!matcher.looksLikeSpam(text);
  }

  function list(state, key) {
    const value = state && state[key];
    return Array.isArray(value) ? value : [];
  }

  // Topic ids expand to labels and synonyms. A phrase that is not a topic id stays as stored.
  function phrases(state, key) {
    const raw = list(state, key);
    const topics = root.JEVTopics;
    if (topics && typeof topics.phrasesFor === "function") return topics.phrasesFor(raw);
    return raw;
  }

  function classifyMessage(message, state) {
    const subject = String((message && message.subject) || "");
    const snippet = String((message && message.snippet) || "");
    const sender = String((message && message.sender) || "");
    if (message && message.junk) return "bad";
    const about = subject + " " + snippet + " " + sender;
    if (phraseHit(about, phrases(state, "notInterests"))) return "bad";
    if (looksLikeSpam(subject + " " + snippet)) return "bad";
    if (phraseHit(about, phrases(state, "interests"))) return "gold";
    return "none";
  }

  function selectAll(node, selector) {
    if (!node || typeof node.querySelectorAll !== "function") return [];
    return Array.from(node.querySelectorAll(selector));
  }

  function locationText(document, locationHash) {
    const bits = [];
    if (locationHash) bits.push(String(locationHash));
    const loc = document && document.location;
    if (loc) bits.push(loc.hash, loc.href, loc.pathname, loc.search);
    return bits.filter(Boolean).join(" ");
  }

  function attr(el, name) {
    if (!el || typeof el.getAttribute !== "function") return "";
    return el.getAttribute(name) || "";
  }

  function labelJunk(value) {
    const text = clean(value);
    if (!text || text.length > 40) return false;
    return /^(spam|junk|junk email)$/i.test(text) || /\b(in spam|junk email)\b/i.test(text);
  }

  function folderJunk(place) {
    return String(place || "").split(/\s+/).some((part) => FOLDER_JUNK.test(part));
  }

  function rowJunk(row, place) {
    if (folderJunk(place)) return true;
    if (labelJunk(attr(row, "aria-label")) || labelJunk(attr(row, "title"))) return true;
    for (const el of selectAll(row, "[title], [aria-label], span")) {
      if (labelJunk(attr(el, "title")) || labelJunk(attr(el, "aria-label"))) return true;
      const onlyText = el.childNodes && el.childNodes.length === 1 && el.childNodes[0].nodeType === 3;
      if (onlyText && labelJunk(el.textContent)) return true;
    }
    return false;
  }

  function directText(el) {
    let text = "";
    for (const node of el.childNodes || []) {
      if (node.nodeType === 3) text += node.nodeValue || "";
    }
    return clean(text);
  }

  function isChromeText(value) {
    const text = clean(value);
    if (text.length < 2) return true;
    if (/^\d{1,2}\+?$/.test(text)) return true;
    if (/^\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?$/i.test(text)) return true;
    if (/^(?:yesterday|today|tomorrow)(?:\s+\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?)?$/i.test(text)) return true;
    if (/^(?:sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\.?(?:,?\s+\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?)?$/i.test(text)) return true;
    if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(text)) return true;
    return false;
  }

  function textLines(row) {
    const lines = [];
    for (const el of selectAll(row, "span, a, p, div")) {
      const text = directText(el);
      if (!text || isChromeText(text)) continue;
      const prev = lines[lines.length - 1];
      if (prev && prev.text.toLowerCase() === text.toLowerCase()) continue;
      lines.push({ el, text });
    }
    return lines;
  }

  function ariaParts(label) {
    return String(label || "")
      .split(/[,|]/)
      .map(clean)
      .filter((part) => part && !isChromeText(part));
  }

  function record(el, subjectEl, subject, snippet, sender, junk, id) {
    const safeSubject = clean(subject);
    return {
      el,
      subjectEl: subjectEl && subjectEl !== el ? subjectEl : null,
      subject: safeSubject,
      snippet: clean(snippet),
      sender: clean(sender),
      junk: !!junk,
      id: clean(id) || safeSubject
    };
  }

  // Opened Gmail messages (.adn / .a3s), including tables inside the body, are not inbox rows.
  function inOpenMessage(node) {
    let current = node;
    while (current && current.nodeType === 1) {
      if (current.classList && (current.classList.contains("a3s") || current.classList.contains("adn"))) return true;
      current = current.parentElement;
    }
    return false;
  }

  function isOpenMessageRow(row) {
    if (!row || inOpenMessage(row)) return true;
    return typeof row.querySelector === "function" && !!row.querySelector(".a3s, .adn");
  }

  function gmailRows(document) {
    const rows = [];
    const seen = new Set();
    function add(row) {
      if (!row || seen.has(row) || isOpenMessageRow(row)) return;
      seen.add(row);
      rows.push(row);
    }
    for (const row of selectAll(document, "tr.zA")) add(row);
    for (const main of selectAll(document, 'div[role="main"]')) {
      for (const row of selectAll(main, 'tr[role="row"]')) add(row);
    }
    return rows;
  }

  function pickedText(row, selector) {
    for (const el of selectAll(row, selector)) {
      if (inOpenMessage(el)) continue;
      const text = clean(el.textContent);
      if (text) return { el, subject: text };
    }
    return null;
  }

  function gmailSubject(row) {
    const bog = pickedText(row, ".bog");
    if (bog) return bog;
    const link = pickedText(row, '[role="link"]');
    if (link) return link;
    const thread = pickedText(row, "span[data-thread-id]");
    if (thread) return thread;
    for (const line of textLines(row)) {
      if (inOpenMessage(line.el)) continue;
      return { el: line.el, subject: line.text };
    }
    return { el: null, subject: "" };
  }

  function findGmail(document, place) {
    const out = [];
    for (const row of gmailRows(document)) {
      const subject = gmailSubject(row);
      const senderEl = row.querySelector(".yP") || row.querySelector(".zF") || row.querySelector("[email]");
      const sender = clean(senderEl && senderEl.textContent) || attr(senderEl, "name") || attr(senderEl, "email");
      const snippetEl = row.querySelector(".y2");
      const snippet = cleanSnippet(snippetEl && snippetEl.textContent);
      const junk = rowJunk(row, place);
      const id = attr(row, "data-legacy-message-id") || attr(row, "data-message-id") || subject.subject;
      out.push(record(row, subject.el, subject.subject, snippet, sender, junk, id));
    }
    return out;
  }

  function spanWithText(row, subject) {
    const wanted = clean(subject);
    if (!wanted) return null;
    let plain = null;
    for (const span of selectAll(row, "span")) {
      if (clean(span.textContent) !== wanted) continue;
      if (span.className) return span;
      if (!plain) plain = span;
    }
    return plain;
  }

  function outlookFields(row) {
    const lines = textLines(row);
    const parts = ariaParts(attr(row, "aria-label"));
    const sender = (lines[0] && lines[0].text) || parts[0] || "";
    if (lines.length >= 2) {
      return {
        sender,
        subject: lines[1].text,
        snippet: lines.slice(2).map((line) => line.text).join(" "),
        subjectEl: lines[1].el
      };
    }
    if (parts.length >= 2) {
      const subject = parts[1];
      return {
        sender,
        subject,
        snippet: parts.slice(2).join(" "),
        subjectEl: spanWithText(row, subject)
      };
    }
    return {
      sender,
      subject: (lines[0] && lines[0].text) || "",
      snippet: "",
      subjectEl: (lines[0] && lines[0].el) || null
    };
  }

  function findOutlook(document, place) {
    const out = [];
    for (const row of selectAll(document, 'div[role="option"]')) {
      const fields = outlookFields(row);
      const aria = attr(row, "aria-label");
      const junk = rowJunk(row, place);
      const id = attr(row, "data-convid") || aria || fields.subject;
      out.push(record(row, fields.subjectEl, fields.subject, fields.snippet, fields.sender, junk, id));
    }
    return out;
  }

  function resolveSite(siteId, hostname) {
    const named = String(siteId || "").toLowerCase();
    if (named === "gmail" || named === "outlook") return named;
    if (root.JEV && typeof root.JEV.siteId === "function") {
      const fromHost = root.JEV.siteId(hostname || "");
      if (fromHost === "gmail" || fromHost === "outlook") return fromHost;
    }
    return "";
  }

  // hostname and locationHash are optional. Junk folders also come from document.location.
  function findMessages(document, siteId, hostname, locationHash) {
    if (!document) return [];
    const site = resolveSite(siteId, hostname);
    const place = locationText(document, locationHash);
    if (site === "gmail") return findGmail(document, place);
    if (site === "outlook") return findOutlook(document, place);
    return [];
  }

  function clear(document) {
    for (const node of selectAll(document, ".jev-gold, .jev-bad, .jev-subject-strike")) {
      node.classList.remove("jev-gold", "jev-bad", "jev-subject-strike");
    }
  }

  function paint(message, kind) {
    const row = message.el;
    if (!row || !row.classList) return;
    const subjectEl = message.subjectEl && message.subjectEl.classList ? message.subjectEl : null;
    if (kind === "gold") {
      row.classList.remove("jev-bad");
      row.classList.add("jev-gold");
      if (subjectEl) subjectEl.classList.remove("jev-subject-strike");
      return;
    }
    if (kind === "bad") {
      row.classList.remove("jev-gold");
      row.classList.add("jev-bad");
      if (subjectEl) subjectEl.classList.add("jev-subject-strike");
      return;
    }
    row.classList.remove("jev-gold", "jev-bad");
    if (subjectEl) subjectEl.classList.remove("jev-subject-strike");
  }

  // Mail ignores the highlight switch and work hours. `now` stays in the signature for the other surfaces.
  function activeSite(state, hostname) {
    const jev = root.JEV;
    if (!jev || typeof jev.siteId !== "function" || typeof jev.siteOn !== "function" || typeof jev.featureOn !== "function") return "";
    const site = jev.siteId(hostname);
    if (site !== "gmail" && site !== "outlook") return "";
    if (!jev.siteOn(state, site) || !jev.featureOn(state, "mail")) return "";
    return site;
  }

  function apply(document, state, now, hostname) {
    if (!document || typeof document.querySelectorAll !== "function") return;
    clear(document);
    const site = activeSite(state, hostname);
    if (!site) return;
    for (const message of findMessages(document, site, hostname, locationText(document))) {
      paint(message, classifyMessage(message, state));
      const ask = root.JEVAsk;
      if (!ask || typeof ask.item !== "function" || !state.apiKey || !message.id) continue;
      const allow = (state.interests || []).join(", ") || "none";
      const block = (state.notInterests || []).join(", ") || "none";
      ask.item("mail", message.id, [message.subject, message.snippet, message.sender].join("\n"), [
        { key: "is_spam", instructions: "Is this email junk or spam? Do not treat a normal sender name as spam.", yes: "It is junk or spam.", no: "It is ordinary mail." },
        { key: "matches_allow", instructions: "Does this email match any of these interest topics: " + allow + "?", yes: "It matches an interest.", no: "It does not." },
        { key: "matches_block", instructions: "Does this email match any of these blocked topics: " + block + "?", yes: "It matches a blocked topic.", no: "It does not." }
      ]).then(function (res) {
        const answers = (res && res.answers) || {};
        if (!message.el || !message.el.parentNode) return;
        if (answers.is_spam || answers.matches_block) paint(message, "bad");
        else if (answers.matches_allow) paint(message, "gold");
      }).catch(function () {});
    }
  }

  function boot(doc) {
    let state = null;
    let timer = 0;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = 0;
        if (!state) return;
        const hostname = (doc.location && doc.location.hostname) || "";
        apply(doc, state, Date.now(), hostname);
      }, DEBOUNCE_MS);
    };
    if (root.JEV && typeof root.JEV.watchState === "function") {
      root.JEV.watchState((next) => {
        state = next;
        schedule();
      });
    }
    const Observer = root.MutationObserver || (typeof MutationObserver === "function" ? MutationObserver : null);
    const target = doc.documentElement || doc.body;
    if (Observer && target) {
      const observer = new Observer(() => schedule());
      observer.observe(target, { childList: true, subtree: true });
    }
  }

  const api = { classifyMessage, findMessages, apply, clear };
  root.JEVMail = api;

  const page = root.document || (typeof document !== "undefined" ? document : null);
  const runtimeId = root.chrome && root.chrome.runtime && root.chrome.runtime.id;
  if (page && runtimeId) boot(page);

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
