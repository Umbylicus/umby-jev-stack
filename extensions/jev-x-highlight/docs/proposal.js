(function (root) {
  "use strict";

  // Service worker importScripts this file. Keep it pure: no document and no window.

  function wordCount(value) {
    return String(value || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function cleanHeading(value) {
    return String(value || "").trim().replace(/^#{1,6}\s+/, "").replace(/^\d+[.)]\s+/, "").replace(/:\s*$/, "").trim();
  }

  function nextContent(lines, index) {
    for (let i = index + 1; i < lines.length; i++) {
      if (lines[i].trim()) return lines[i];
    }
    return "";
  }

  function isHeading(line, next) {
    const trimmed = String(line || "").trim();
    if (!trimmed || trimmed.length > 90) return false;
    if (/^#{1,6}\s+\S/.test(trimmed)) return true;
    if (/^\d+[.)]\s+\S/.test(trimmed)) return wordCount(trimmed) <= 12 && !/[.!?]$/.test(trimmed);
    if (/:\s*$/.test(trimmed) && wordCount(trimmed) <= 12) return true;
    if (/[.!?]$/.test(trimmed) || wordCount(trimmed) > 6) return false;
    if (/^\d/.test(trimmed)) return false;
    if (/\b(is|are|was|were|shall|will|must|may|have|has)\b/i.test(trimmed)) return false;
    return !!(next && String(next).trim());
  }

  function extractClauses(text) {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    const clauses = [];
    let heading = "";
    let body = [];
    let started = false;

    function flush() {
      if (!started) return;
      const head = cleanHeading(heading);
      const clauseText = body.join("\n").trim();
      if (!head && !clauseText) return;
      clauses.push({ heading: head || "Clause", text: clauseText });
    }

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      if (isHeading(lines[i], nextContent(lines, i))) {
        flush();
        heading = lines[i];
        body = [];
        started = true;
        continue;
      }
      if (!started) started = true;
      body.push(lines[i].trim());
    }
    flush();
    if (!clauses.length && String(text || "").trim()) {
      clauses.push({ heading: "Document", text: String(text).trim() });
    }
    return clauses;
  }

  function sentencesOf(text) {
    const source = String(text || "").replace(/\r\n/g, "\n").trim();
    if (!source) return [];
    return source.split(/\n+|(?<=[.!?])\s+/).map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
  }

  function amountValue(raw) {
    const match = String(raw || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    if (!match) return "";
    const number = Number(match[1]);
    return Number.isFinite(number) ? String(number) : "";
  }

  function moneyTokens(text) {
    const found = [];
    const pattern = /(?:\$|€|£)\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s*(?:dollars|usd|eur|gbp)\b|\b(?:fee|fees|cost|costs|price|priced)\b[^.$\n€£]{0,24}(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:fee|fees|cost|costs|price)\b/gi;
    let match;
    while ((match = pattern.exec(String(text || "")))) {
      const value = amountValue(match[1] || match[2] || match[0]);
      if (value) found.push(value);
      if (!match[0]) pattern.lastIndex += 1;
    }
    found.sort();
    return found;
  }

  function termTokens(text) {
    const source = String(text || "").toLowerCase();
    const found = [];
    const duration = /\b(\d+)\s*(day|week|month|year)s?\b/g;
    let match;
    while ((match = duration.exec(source))) found.push(match[1] + " " + match[2]);
    const named = /\b(annual|annually|monthly|weekly|daily|quarterly|yearly)\b/g;
    while ((match = named.exec(source))) {
      const word = match[1] === "annually" || match[1] === "yearly" ? "annual" : match[1];
      found.push(word);
    }
    const net = /\bnet[\s-]+(\d+)\b/g;
    while ((match = net.exec(source))) found.push("net " + match[1]);
    found.sort();
    return found;
  }

  function isLiabilitySentence(sentence) {
    return /liabilit|indemn|damages|hold harmless|limitation of liability/i.test(sentence);
  }

  function liabilitySentences(text) {
    return sentencesOf(text).filter(isLiabilitySentence);
  }

  function normLiability(sentence) {
    return String(sentence || "")
      .toLowerCase()
      .replace(/\b(shall|will|must)\b/g, "modal")
      .replace(/[^a-z0-9$]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sameList(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function headingKey(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function nonLiabilityText(text) {
    return sentencesOf(text).filter((sentence) => !isLiabilitySentence(sentence)).join(" ");
  }

  function priceText(text) {
    const lines = sentencesOf(text).filter((sentence) => !isLiabilitySentence(sentence) && moneyTokens(sentence).length);
    return lines.join(" ");
  }

  function termText(text) {
    return sentencesOf(text).filter((sentence) => termTokens(sentence).length).join(" ");
  }

  function sourceText(clause) {
    const heading = clause && clause.heading && clause.heading !== "Clause" && clause.heading !== "Document" ? clause.heading : "";
    const text = (clause && clause.text) || "";
    return heading ? heading + "\n" + text : text;
  }

  function compareClause(a, b) {
    const diffs = [];
    const heading = (a && a.heading) || (b && b.heading) || "Clause";
    const aText = sourceText(a);
    const bText = sourceText(b);
    if (!sameList(moneyTokens(nonLiabilityText(aText)), moneyTokens(nonLiabilityText(bText)))) {
      diffs.push({ heading, change: "price", before: priceText(aText), after: priceText(bText) });
    }
    if (!sameList(termTokens(aText), termTokens(bText))) {
      diffs.push({ heading, change: "term", before: termText(aText), after: termText(bText) });
    }
    const aLiability = liabilitySentences(aText).map(normLiability);
    const bLiability = liabilitySentences(bText).map(normLiability);
    if (!sameList(aLiability, bLiability)) {
      diffs.push({
        heading,
        change: "liability",
        before: liabilitySentences(aText).join(" "),
        after: liabilitySentences(bText).join(" ")
      });
    }
    return diffs;
  }

  function diffProposals(aText, bText) {
    const aClauses = extractClauses(aText);
    const bClauses = extractClauses(bText);
    const pool = bClauses.map((clause) => ({ clause, used: false }));
    const diffs = [];
    for (const clause of aClauses) {
      const key = headingKey(clause.heading);
      const found = pool.find((item) => !item.used && headingKey(item.clause.heading) === key);
      if (!found) {
        diffs.push(...compareClause(clause, { heading: clause.heading, text: "" }));
        continue;
      }
      found.used = true;
      diffs.push(...compareClause(clause, found.clause));
    }
    for (const item of pool) {
      if (item.used) continue;
      diffs.push(...compareClause({ heading: item.clause.heading, text: "" }, item.clause));
    }
    return diffs;
  }

  const api = { extractClauses, diffProposals };
  root.JEVProposal = Object.assign(root.JEVProposal || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
