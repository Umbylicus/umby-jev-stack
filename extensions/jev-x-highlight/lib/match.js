(function (root) {
  "use strict";

  const SPAM_PHRASES = [
    "giveaway",
    "airdrop",
    "follow back",
    "f4f",
    "dm to win",
    "crypto signal",
    "guaranteed profit",
    "link in bio",
    "onlyfans",
    "double your money"
  ];

  function asText(value) {
    if (value == null) return "";
    return String(value);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }

  const patternCache = new Map();

  function phrasePattern(phrase) {
    const key = String(phrase || "");
    if (patternCache.has(key)) return patternCache.get(key);
    const parts = key.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
    let pattern = null;
    if (parts.length) {
      try {
        pattern = new RegExp("(?<![\\p{L}\\p{N}])" + parts.join("\\s+") + "(?![\\p{L}\\p{N}])", "iu");
      } catch (error) {
        pattern = null;
      }
    }
    patternCache.set(key, pattern);
    return pattern;
  }

  function phraseHit(text, phrases) {
    const source = asText(text).replace(/\u00a0/g, " ");
    if (!source || !Array.isArray(phrases)) return false;
    for (const phrase of phrases) {
      const pattern = phrasePattern(phrase);
      if (pattern && pattern.test(source)) return true;
    }
    return false;
  }

  function accountHit(author, accounts) {
    if (!Array.isArray(accounts)) return false;
    const cleaned = [];
    for (const account of accounts) {
      const name = asText(account).trim().replace(/^@+/, "");
      if (name) cleaned.push(name);
    }
    return phraseHit(author, cleaned);
  }

  function looksLikeSpam(text) {
    return phraseHit(text, SPAM_PHRASES);
  }

  function classify(input, state) {
    const item = input || {};
    const text = asText(item.text);
    const author = asText(item.author);
    const features = (state && state.features) || {};
    const topics = root.JEVTopics;
    const blocked = topics && topics.phrasesFor ? topics.phrasesFor(state && state.notInterests) : (state && state.notInterests);
    const allowed = topics && topics.phrasesFor ? topics.phrasesFor(state && state.interests) : (state && state.interests);
    if (item.ad || looksLikeSpam(text)) return "bad";
    if (phraseHit(text, blocked)) return "bad";
    if (features.redAccounts && accountHit(author, state && state.redAccounts)) return "bad";
    if (phraseHit(text, allowed)) return "gold";
    if (features.goldAccounts && accountHit(author, state && state.goldAccounts)) return "gold";
    return "none";
  }

  const api = { phraseHit, accountHit, looksLikeSpam, classify };
  root.JEVMatch = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
