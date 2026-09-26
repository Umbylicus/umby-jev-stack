"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PAGE_CAP = 500;
export const CRAWL_CONCURRENCY = 4;
export const JEV_CONCURRENCY = 8;
export const FETCH_TIMEOUT_MS = 10_000;
export const JEV_TIMEOUT_MS = 30_000;
export const CONFIDENCE_MIN = 0.7;
export const SHORTLIST_SIZE = 6;
export const USER_AGENT =
  "UmbyJevLink/1.0 (+https://github.com/Umbylicus/umby-jev-stack; look-only internal-link inventory)";
export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const QUESTION_KEY = "best_internal_link_target";

const TRACKING_PARAM = /^(utm_|fbclid|gclid|gbraid|wbraid|msclkid|mc_|igshid|_ga|_gl$|ref$)/i;
const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with", "from",
  "this", "that", "our", "your", "you", "we", "us", "are", "is", "was", "be",
  "at", "by", "as", "it", "its", "if", "not", "can", "has", "have", "will",
  "than", "then", "but", "into", "over", "also", "more", "any", "all", "out"
]);
const BAD_ANCHOR = /^(click here|here|learn more|read more|this page|this|link|click)$/i;
const UTILITY_PATH = /(^|\/)(privacy|terms|legal|cookie|cookies|sitemap)(\/|\.|$)/i;
const CONTACT_PATH = /(^|\/)(contact|book|booking|schedule)(\/|\.|$)/i;

export function skillDir() {
  return path.dirname(fileURLToPath(import.meta.url));
}

export function loadFrozenQuestions() {
  const file = path.join(skillDir(), "questions.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function stripWww(host) {
  return String(host || "").toLowerCase().replace(/^www\./, "");
}

export function sameHost(a, b) {
  try {
    return stripWww(new URL(a).hostname) === stripWww(new URL(b).hostname);
  } catch {
    return false;
  }
}

export function normalizeUrl(href, base) {
  let u;
  try {
    u = new URL(href, base);
  } catch {
    return "";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  u.hash = "";
  const kept = [];
  for (const [key, value] of u.searchParams.entries()) {
    if (TRACKING_PARAM.test(key) || key.toLowerCase().startsWith("utm_")) continue;
    kept.push([key, value]);
  }
  kept.sort(([left], [right]) => left.localeCompare(right));
  u.search = "";
  for (const [key, value] of kept) u.searchParams.append(key, value);
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) {
    u.port = "";
  }
  u.hostname = u.hostname.toLowerCase();
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.href;
}

export function isHomeUrl(url) {
  try {
    const { pathname } = new URL(url);
    return pathname === "/" || pathname === "/index.html" || pathname === "/index.htm";
  } catch {
    return false;
  }
}

export function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

export function innerText(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function attr(tag, name) {
  const quoted = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = String(tag || "").match(quoted);
  return match ? decodeEntities(match[1]) : "";
}

function stripChrome(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ");
}

export function parseRobotsSitemaps(robotsText) {
  const urls = [];
  for (const line of String(robotsText || "").split(/\r?\n/)) {
    const match = line.match(/^\s*sitemap\s*:\s*(\S+)/i);
    if (match) urls.push(match[1].trim());
  }
  return urls;
}

export function parseSitemapXml(xml) {
  const indexes = [];
  const urls = [];
  const indexBlocks = String(xml || "").matchAll(/<sitemap\b[\s\S]*?<\/sitemap>/gi);
  for (const block of indexBlocks) {
    const loc = block[0].match(/<loc>\s*([^<]+)\s*<\/loc>/i);
    if (loc) indexes.push(decodeEntities(loc[1].trim()));
  }
  const urlBlocks = String(xml || "").matchAll(/<url\b[\s\S]*?<\/url>/gi);
  for (const block of urlBlocks) {
    const loc = block[0].match(/<loc>\s*([^<]+)\s*<\/loc>/i);
    if (loc) urls.push(decodeEntities(loc[1].trim()));
  }
  return { indexes, urls };
}

export function extractPage(html, pageUrl) {
  const raw = String(html || "");
  const title = innerText((raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  let robots = "";
  let canonical = "";
  const metas = raw.matchAll(/<meta\b([^>]*)\/?>/gi);
  for (const meta of metas) {
    const tag = meta[1] || "";
    const name = (attr(tag, "name") || attr(tag, "http-equiv")).toLowerCase();
    if (name === "robots" || name === "x-robots-tag") robots = attr(tag, "content");
  }
  const links = raw.matchAll(/<link\b([^>]*)\/?>/gi);
  for (const link of links) {
    const tag = link[1] || "";
    const rel = attr(tag, "rel").toLowerCase();
    if (rel.split(/\s+/).includes("canonical")) canonical = normalizeUrl(attr(tag, "href"), pageUrl);
  }

  const hrefs = [];
  const anchors = raw.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const anchor of anchors) {
    const href = normalizeUrl(attr(anchor[1], "href"), pageUrl);
    if (href && sameHost(href, pageUrl)) hrefs.push(href);
  }

  const main = stripChrome(raw);
  const headings = [];
  const passages = [];
  const headingStack = [];
  const counts = new Map();
  const blockRe = /<(h[1-6]|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = blockRe.exec(main))) {
    const tag = match[1].toLowerCase();
    const text = innerText(match[3]);
    if (!text) continue;
    if (tag.startsWith("h")) {
      const level = Number(tag[1]);
      while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, text });
      headings.push(text);
      continue;
    }
    if (text.length < 40) continue;
    if (/copyright|all rights reserved|privacy policy/i.test(text)) continue;
    const headingPath = headingStack.map((item) => item.text).join(" > ") || title || "(untitled)";
    const next = (counts.get(headingPath) || 0) + 1;
    counts.set(headingPath, next);
    passages.push({
      heading_path: headingPath,
      paragraph_index: next,
      location: `${headingPath} > p[${next}]`,
      excerpt: text,
      text
    });
  }

  return {
    url: pageUrl,
    title,
    robots,
    canonical,
    headings,
    passages,
    internal_links: [...new Set(hrefs)],
    noindex: /\bnoindex\b/i.test(robots)
  };
}

export function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^-+|-+$/g, ""))
    .filter((token) => token.length > 2 && !STOP.has(token));
}

export function tfidfVectors(docs) {
  const df = new Map();
  for (const tokens of docs) {
    for (const token of new Set(tokens)) df.set(token, (df.get(token) || 0) + 1);
  }
  const n = docs.length || 1;
  return docs.map((tokens) => {
    const tf = new Map();
    for (const token of tokens) tf.set(token, (tf.get(token) || 0) + 1);
    const vec = new Map();
    const len = tokens.length || 1;
    for (const [token, count] of tf) {
      const idf = Math.log((n + 1) / ((df.get(token) || 0) + 1)) + 1;
      vec.set(token, (count / len) * idf);
    }
    return vec;
  });
}

export function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const [key, value] of left) {
    leftNorm += value * value;
    if (right.has(key)) dot += value * right.get(key);
  }
  for (const value of right.values()) rightNorm += value * value;
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function jaccard(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size || !right.size) return 0;
  let inter = 0;
  for (const token of left) if (right.has(token)) inter += 1;
  return inter / new Set([...left, ...right]).size;
}

export function pageRole(page) {
  const url = page.url || "";
  if (UTILITY_PATH.test(url)) return "utility";
  if (CONTACT_PATH.test(url) || /contact/i.test(page.title || "")) return "contact";
  if (isHomeUrl(url)) return "home";
  return "content";
}

export function pagePurpose(page) {
  const first = (page.passages[0] && page.passages[0].text) || "";
  const heading = page.headings[0] || "";
  return (first || `${page.title} ${heading}`).slice(0, 180);
}

export function targetDocument(page) {
  return [page.title, ...(page.headings || [])].join(" ");
}

export function rankTargets(passage, source, pages, limit = SHORTLIST_SIZE) {
  const queryTokens = tokenize(`${passage.heading_path} ${passage.text}`);
  const eligible = [];
  for (const page of pages) {
    if (page.url === source.url) continue;
    if (source.internal_links.includes(page.url)) continue;
    const role = pageRole(page);
    if (role === "utility") continue;
    eligible.push(page);
  }
  if (!eligible.length) return [];

  const docs = [queryTokens, ...eligible.map((page) => tokenize(targetDocument(page)))];
  const vectors = tfidfVectors(docs);
  const queryVec = vectors[0];
  const scored = eligible.map((page, index) => {
    const tokens = docs[index + 1];
    let score = 0.72 * cosine(queryVec, vectors[index + 1]) + 0.28 * jaccard(queryTokens, tokens);
    const role = pageRole(page);
    if (role === "home") score *= 0.55;
    if (role === "contact" && !/\b(call|book|schedule|appointment|visit)\b/i.test(passage.text)) {
      score *= 0.4;
    }
    return {
      id: page.id,
      url: page.url,
      title: page.title,
      headings: (page.headings || []).slice(0, 4).join(" | "),
      purpose: pagePurpose(page),
      role,
      score
    };
  });
  scored.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  return scored.filter((row) => row.score > 0.02).slice(0, limit);
}

export function suggestAnchor(passageText, target) {
  const hay = String(passageText || "").replace(/\s+/g, " ").trim();
  const words = hay.split(" ").filter(Boolean);
  const targetTerms = new Set(tokenize(`${target.title} ${target.headings || ""}`));
  let best = "";
  let bestScore = 0;
  const maxN = Math.min(6, words.length);
  for (let n = maxN; n >= 2; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const phrase = words.slice(i, i + n).join(" ").replace(/[.,;:!?]+$/g, "");
      if (BAD_ANCHOR.test(phrase)) continue;
      const tokens = tokenize(phrase);
      if (!tokens.length) continue;
      const overlap = tokens.filter((token) => targetTerms.has(token)).length;
      if (!overlap) continue;
      const score = overlap / tokens.length + overlap * 0.2 + n * 0.02;
      if (score > bestScore) {
        bestScore = score;
        best = phrase;
      }
    }
  }
  if (best && best.length >= 4 && best.length <= 80) return best;
  const fallback = words.slice(0, Math.min(5, words.length)).join(" ").replace(/[.,;:!?]+$/g, "");
  return fallback.slice(0, 80) || (target.title || "this page").slice(0, 80);
}

export function populateQuestions(frozen, candidates) {
  const questions = structuredClone(frozen);
  const criteria = { ...(questions[QUESTION_KEY].criteria || {}) };
  for (const candidate of candidates) {
    criteria[candidate.id] = {
      what: `${candidate.title}: ${candidate.purpose || candidate.headings || "Indexable page that may continue this passage."}`
    };
  }
  if (!criteria.no_link) {
    criteria.no_link = {
      what: "None of the offered candidates is a useful and accurate next step from this passage."
    };
  }
  questions[QUESTION_KEY].criteria = criteria;
  return questions;
}

export function buildState(source, passage, candidates) {
  return {
    source_url: source.url,
    source_title: source.title,
    heading: passage.heading_path,
    passage: passage.text.slice(0, 1500),
    existing_internal_links: source.internal_links,
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      url: candidate.url,
      title: candidate.title,
      purpose: candidate.purpose,
      headings: candidate.headings
    }))
  };
}

export function stubScore(candidates) {
  const probabilities = {};
  if (!candidates.length) {
    return { choice: "no_link", confidence: 0.95, probabilities: { no_link: 1 }, model: "stub-local" };
  }
  const best = candidates[0];
  const second = candidates[1] ? candidates[1].score : 0;
  if (best.score < 0.12) {
    probabilities.no_link = 0.72;
    for (const candidate of candidates) {
      probabilities[candidate.id] = Number((candidate.score * 0.4).toFixed(4));
    }
    return { choice: "no_link", confidence: 0.82, probabilities, model: "stub-local" };
  }
  const gap = Math.max(0, best.score - second);
  const confidence = Math.min(0.97, Math.max(0.55, 0.5 + best.score * 0.7 + gap * 0.35));
  const mass = candidates.reduce((sum, row) => sum + row.score, 0) + 0.08;
  for (const candidate of candidates) {
    probabilities[candidate.id] = Number((candidate.score / mass).toFixed(4));
  }
  probabilities.no_link = Number((0.08 / mass).toFixed(4));
  return {
    choice: best.id,
    confidence: Number(confidence.toFixed(4)),
    probabilities,
    model: "stub-local"
  };
}

export function readChoice(response, key = QUESTION_KEY) {
  const row = response && response.answers && response.answers[key];
  if (!row) return null;
  const choice = String(row.choice || "");
  const confidence = Number(row.confidence);
  const probabilities = row.probabilities && typeof row.probabilities === "object" ? row.probabilities : {};
  if (!choice || !Number.isFinite(confidence)) return null;
  return {
    choice,
    confidence,
    probabilities,
    model: response.model || ""
  };
}

export async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await worker(items[index], index);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length || 1));
  await Promise.all(Array.from({ length: items.length ? n : 0 }, () => run()));
  return out;
}

export async function fetchResponse(url, { timeout = FETCH_TIMEOUT_MS, redirect = "manual", fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetchImpl(url, {
      redirect,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

function header(res, name) {
  if (!res || !res.headers || typeof res.headers.get !== "function") return "";
  return res.headers.get(name) || "";
}

function isHtmlContentType(value) {
  const type = String(value || "").toLowerCase();
  return type.includes("text/html") || type.includes("application/xhtml") || type === "";
}

function isXmlContentType(value) {
  const type = String(value || "").toLowerCase();
  return type.includes("xml") || type.includes("text/plain") || type === "";
}

export async function readBody(res, timeout = FETCH_TIMEOUT_MS) {
  if (!res) return "";
  if (typeof res.text !== "function") return "";
  return Promise.race([
    res.text(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("body timeout")), timeout);
    })
  ]);
}

export async function discoverSitemapUrls(startUrl, { fetchImpl = fetch, maxPages = PAGE_CAP } = {}) {
  const origin = new URL(startUrl).origin;
  const seen = new Set();
  const found = [];
  const queue = [];

  async function addSitemap(url) {
    const normalized = normalizeUrl(url, origin);
    if (!normalized || seen.has(normalized) || !sameHost(normalized, startUrl)) return;
    seen.add(normalized);
    queue.push(normalized);
  }

  try {
    const robots = await fetchResponse(new URL("/robots.txt", origin).href, {
      fetchImpl,
      redirect: "follow"
    });
    if (robots && robots.ok) {
      const text = await readBody(robots);
      for (const sitemap of parseRobotsSitemaps(text)) await addSitemap(sitemap);
    }
  } catch {
    // robots.txt is optional
  }

  if (!queue.length) await addSitemap(new URL("/sitemap.xml", origin).href);

  while (queue.length && found.length < maxPages) {
    const sitemapUrl = queue.shift();
    let res;
    try {
      res = await fetchResponse(sitemapUrl, { fetchImpl, redirect: "follow" });
    } catch {
      continue;
    }
    if (!res || !res.ok) continue;
    if (!isXmlContentType(header(res, "content-type")) && !/sitemap/i.test(sitemapUrl)) continue;
    let xml = "";
    try {
      xml = await readBody(res);
    } catch {
      continue;
    }
    const parsed = parseSitemapXml(xml);
    for (const index of parsed.indexes) await addSitemap(index);
    for (const loc of parsed.urls) {
      const url = normalizeUrl(loc, origin);
      if (!url || !sameHost(url, startUrl)) continue;
      if (found.includes(url)) continue;
      found.push(url);
      if (found.length >= maxPages) break;
    }
  }
  return found.slice(0, maxPages);
}

export function extractCrawlLinks(html, pageUrl, startUrl) {
  const urls = [];
  const anchors = String(html || "").matchAll(/<a\b([^>]*)>/gi);
  for (const anchor of anchors) {
    const href = normalizeUrl(attr(anchor[1], "href"), pageUrl);
    if (href && sameHost(href, startUrl)) urls.push(href);
  }
  return [...new Set(urls)];
}

export async function crawlSameHost(startUrl, { fetchImpl = fetch, maxPages = PAGE_CAP, concurrency = CRAWL_CONCURRENCY } = {}) {
  const seed = normalizeUrl(startUrl);
  const seen = new Set();
  const queued = [seed];
  const htmlPages = [];

  async function visit(url) {
    if (htmlPages.length >= maxPages) return [];
    let res;
    try {
      res = await fetchResponse(url, { fetchImpl, redirect: "manual" });
    } catch {
      return [];
    }
    if (!res) return [];
    if (res.status >= 300 && res.status < 400) {
      const location = normalizeUrl(header(res, "location"), url);
      return location && sameHost(location, startUrl) ? [location] : [];
    }
    if (!res.ok) return [];
    if (!isHtmlContentType(header(res, "content-type"))) return [];
    let html = "";
    try {
      html = await readBody(res);
    } catch {
      return [];
    }
    htmlPages.push({ url, html, status: res.status, headers: headersObject(res) });
    return extractCrawlLinks(html, url, startUrl);
  }

  while (queued.length && htmlPages.length < maxPages) {
    const batch = [];
    while (queued.length && batch.length < concurrency && htmlPages.length + batch.length < maxPages) {
      const url = queued.shift();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      batch.push(url);
    }
    if (!batch.length) break;
    const discovered = await mapLimit(batch, concurrency, visit);
    for (const links of discovered) {
      for (const url of links || []) {
        if (!seen.has(url) && !queued.includes(url)) queued.push(url);
      }
    }
  }
  return htmlPages.slice(0, maxPages);
}

function headersObject(res) {
  const out = {};
  if (!res || !res.headers) return out;
  if (typeof res.headers.forEach === "function") {
    res.headers.forEach((value, key) => {
      out[String(key).toLowerCase()] = value;
    });
  }
  return out;
}

export function isIndexable(record, pageUrl) {
  if (!record) return { ok: false, reason: "missing" };
  if (record.status >= 300 && record.status < 400) return { ok: false, reason: "redirect" };
  if (record.status >= 400) return { ok: false, reason: `http_${record.status}` };
  const type = record.contentType || "";
  if (type && !isHtmlContentType(type)) return { ok: false, reason: "not_html" };
  if (record.robotsHeader && /\bnoindex\b/i.test(record.robotsHeader)) {
    return { ok: false, reason: "noindex_header" };
  }
  if (record.page.noindex) return { ok: false, reason: "noindex" };
  if (record.page.canonical && normalizeUrl(record.page.canonical) !== normalizeUrl(pageUrl)) {
    return { ok: false, reason: "canonical_elsewhere" };
  }
  return { ok: true, reason: "indexable" };
}

export async function fetchInventory(urls, startUrl, { fetchImpl = fetch, concurrency = CRAWL_CONCURRENCY } = {}) {
  const unique = [];
  const seen = new Set();
  for (const raw of urls) {
    const url = normalizeUrl(raw, startUrl);
    if (!url || seen.has(url) || !sameHost(url, startUrl)) continue;
    seen.add(url);
    unique.push(url);
  }

  const rows = await mapLimit(unique, concurrency, async (url) => {
    let res;
    try {
      res = await fetchResponse(url, { fetchImpl, redirect: "manual" });
    } catch (error) {
      return { url, status: 0, error: error.name === "AbortError" ? "timeout" : "fetch_failed" };
    }
    if (!res) return { url, status: 0, error: "empty" };
    const contentType = header(res, "content-type");
    const robotsHeader = header(res, "x-robots-tag");
    let html = "";
    if (res.status >= 200 && res.status < 300) {
      try {
        html = await readBody(res);
      } catch {
        html = "";
      }
    }
    const page = html ? extractPage(html, url) : {
      url,
      title: "",
      robots: "",
      canonical: "",
      headings: [],
      passages: [],
      internal_links: [],
      noindex: false
    };
    return {
      url,
      status: res.status,
      contentType,
      robotsHeader,
      page,
      location: header(res, "location")
    };
  });
  return rows;
}

export function compileIndexable(records) {
  const kept = [];
  const dropped = [];
  const seenText = new Map();
  for (const record of records) {
    const decision = isIndexable(record, record.url);
    if (!decision.ok) {
      dropped.push({ url: record.url, reason: decision.reason, status: record.status });
      continue;
    }
    const fingerprint = tokenize([record.page.title, ...(record.page.headings || []), (record.page.passages[0] || {}).text].join(" ")).join(" ");
    if (fingerprint && seenText.has(fingerprint)) {
      dropped.push({ url: record.url, reason: "duplicate", status: record.status });
      continue;
    }
    if (fingerprint) seenText.set(fingerprint, record.url);
    kept.push(record);
  }
  kept.sort((a, b) => a.url.localeCompare(b.url));
  return {
    pages: kept.map((record, index) => ({
      id: `p${index + 1}`,
      url: record.url,
      title: record.page.title,
      headings: record.page.headings,
      passages: record.page.passages,
      internal_links: record.page.internal_links
    })),
    dropped
  };
}

export async function askJev(state, questions, { apiKey, fetchImpl = fetch, timeout = JEV_TIMEOUT_MS } = {}) {
  if (!apiKey) throw new Error("JEV_API_KEY is missing");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetchImpl(JEV_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT
      },
      body: JSON.stringify({
        model: "jev-latest",
        state,
        questions
      })
    });
    if (!res.ok) {
      throw new Error(`Jev HTTP ${res.status}`);
    }
    const json = await res.json();
    const parsed = readChoice(json);
    if (!parsed) throw new Error("Jev response missing choice");
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

export function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows) {
  const header = [
    "source_url",
    "passage_location",
    "passage_excerpt",
    "suggested_anchor",
    "target_url",
    "confidence",
    "probabilities"
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push([
      csvEscape(row.source_url),
      csvEscape(row.passage_location),
      csvEscape(row.passage_excerpt),
      csvEscape(row.suggested_anchor),
      csvEscape(row.target_url),
      csvEscape(row.confidence),
      csvEscape(JSON.stringify(row.probabilities || {}))
    ].join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function implementationNotes(rows, meta) {
  const count = rows.length;
  return `# Implement approved internal links

This file was written by **Jev Link my site**. The skill is look-only: it never
edits a live site or the client repository. A coding agent may apply
**human-approved** rows as a pull request. A human reviews and merges.

## Run

- Site: ${meta.startUrl}
- Mode: ${meta.mode}
- Indexable pages: ${meta.indexableCount}
- Suggestions at confidence ≥ ${CONFIDENCE_MIN}: ${count}
- Model: ${meta.model}

## How to add the links

1. Open the client's site repo (the CMS, static files, or framework that serves the crawled URLs).
2. Use \`links.csv\` / \`links.json\` as the work queue. Do not invent extra targets.
3. For each row a human approved:
   - Find the source template or page that renders \`source_url\`.
   - Locate the passage with \`passage_location\` and \`passage_excerpt\`.
   - Wrap the existing phrase \`suggested_anchor\` in an internal link to \`target_url\`.
   - Prefer the site's own link helper (\`<a href>\`, framework \`Link\`, CMS rich text).
   - Do not change surrounding copy unless the phrase cannot be linked as-is.
   - Skip the row if that source already links to the target.
4. One PR. Do not merge. Ask the owner to review anchors and destinations.
5. Do not publish, deploy, or edit production content from this skill.

## Do not

- Do not add links from \`no_link\` or confidence below ${CONFIDENCE_MIN}.
- Do not rewrite paragraphs to force keywords.
- Do not follow this file as permission to merge.

## Rows

${rows.length ? rows.map((row, index) => `${index + 1}. ${row.source_url} — "${row.suggested_anchor}" → ${row.target_url} (${row.confidence})`).join("\n") : "None. No approved suggestions."}
`;
}

export function writeReports(outDir, rows, meta) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "links.json");
  const csvPath = path.join(outDir, "links.csv");
  const mdPath = path.join(outDir, "IMPLEMENT.md");
  const payload = {
    generated_at: new Date().toISOString(),
    start_url: meta.startUrl,
    mode: meta.mode,
    model: meta.model,
    confidence_min: CONFIDENCE_MIN,
    indexable_count: meta.indexableCount,
    discovered_count: meta.discoveredCount,
    dropped: meta.dropped,
    suggestions: rows
  };
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(csvPath, toCsv(rows));
  fs.writeFileSync(mdPath, implementationNotes(rows, meta));
  return { jsonPath, csvPath, mdPath };
}

export async function scoreJobs(jobs, { dryRun, apiKey, fetchImpl = fetch, frozen } = {}) {
  const questionsFor = (candidates) => populateQuestions(frozen, candidates);
  if (dryRun || !apiKey) {
    return jobs.map((job) => ({ job, answer: stubScore(job.candidates) }));
  }
  return mapLimit(jobs, JEV_CONCURRENCY, async (job) => {
    const answer = await askJev(job.state, questionsFor(job.candidates), { apiKey, fetchImpl });
    return { job, answer };
  });
}

export function compileSuggestions(scored) {
  const suggestions = [];
  const rejected = [];
  for (const { job, answer } of scored) {
    const record = {
      source_url: job.source.url,
      passage_location: job.passage.location,
      passage_excerpt: job.passage.text,
      choice: answer.choice,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
      model: answer.model,
      candidates: job.candidates.map((candidate) => ({
        id: candidate.id,
        url: candidate.url,
        title: candidate.title,
        score: Number(candidate.score.toFixed(4))
      }))
    };
    if (answer.choice === "no_link" || answer.confidence < CONFIDENCE_MIN) {
      rejected.push({ ...record, reason: answer.choice === "no_link" ? "no_link" : "low_confidence" });
      continue;
    }
    const target = job.candidates.find((candidate) => candidate.id === answer.choice);
    if (!target) {
      rejected.push({ ...record, reason: "unknown_choice" });
      continue;
    }
    suggestions.push({
      source_url: job.source.url,
      passage_location: job.passage.location,
      passage_excerpt: job.passage.text,
      suggested_anchor: suggestAnchor(job.passage.text, target),
      target_url: target.url,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
      model: answer.model,
      choice: answer.choice
    });
  }
  suggestions.sort((a, b) => b.confidence - a.confidence || a.source_url.localeCompare(b.source_url));
  return { suggestions, rejected };
}

export async function runLinkInventory(options) {
  const startUrl = normalizeUrl(options.url);
  if (!startUrl) throw new Error("A valid --url is required");
  const fetchImpl = options.fetchImpl || fetch;
  const maxPages = options.maxPages || PAGE_CAP;
  const dryRun = Boolean(options.dryRun);
  const apiKey = options.apiKey || "";
  const frozen = options.frozen || loadFrozenQuestions();
  const outDir = options.outDir;

  let discovered = await discoverSitemapUrls(startUrl, { fetchImpl, maxPages });
  let discovery = "sitemap";
  if (!discovered.length) {
    discovery = "crawl";
    const crawled = await crawlSameHost(startUrl, { fetchImpl, maxPages });
    discovered = crawled.map((row) => row.url);
  }
  discovered = discovered.slice(0, maxPages);
  const records = await fetchInventory(discovered, startUrl, { fetchImpl });
  const compiled = compileIndexable(records);
  const jobs = [];
  for (const page of compiled.pages) {
    for (const passage of page.passages) {
      const candidates = rankTargets(passage, page, compiled.pages);
      if (!candidates.length) continue;
      jobs.push({
        source: page,
        passage,
        candidates,
        state: buildState(page, passage, candidates)
      });
    }
  }
  const scored = await scoreJobs(jobs, { dryRun, apiKey, fetchImpl, frozen });
  const { suggestions, rejected } = compileSuggestions(scored);
  const model = (scored[0] && scored[0].answer.model) || (dryRun || !apiKey ? "stub-local" : "jev-latest");
  const meta = {
    startUrl,
    mode: dryRun || !apiKey ? "dry-run" : "live",
    model,
    discovery,
    indexableCount: compiled.pages.length,
    discoveredCount: discovered.length,
    dropped: compiled.dropped
  };
  const files = outDir ? writeReports(outDir, suggestions, meta) : null;
  return {
    ...meta,
    jobs: jobs.length,
    suggestions,
    rejected,
    pages: compiled.pages,
    files
  };
}
