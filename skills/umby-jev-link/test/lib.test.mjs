"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONFIDENCE_MIN,
  CRAWL_CONCURRENCY,
  FETCH_TIMEOUT_MS,
  PAGE_CAP,
  USER_AGENT,
  compileIndexable,
  compileSuggestions,
  cosine,
  extractPage,
  isIndexable,
  loadFrozenQuestions,
  normalizeUrl,
  parseRobotsSitemaps,
  parseSitemapXml,
  populateQuestions,
  rankTargets,
  sameHost,
  stubScore,
  suggestAnchor,
  tfidfVectors,
  toCsv,
  tokenize,
  writeReports
} from "../lib.mjs";

const skillDir = path.dirname(fileURLToPath(new URL("../link.mjs", import.meta.url)));

test("tracking params are dropped and hosts compare without www", () => {
  assert.equal(
    normalizeUrl("https://WWW.Example.com/drain/?utm_source=x&fbclid=1&b=2&a=1#top"),
    "https://example.com/drain?a=1&b=2"
  );
  assert.equal(sameHost("https://www.example.com/a", "https://example.com/b"), true);
  assert.equal(sameHost("https://other.test/a", "https://example.com/a"), false);
  assert.equal(normalizeUrl("javascript:alert(1)"), "");
});

test("robots and sitemap indexes are parsed", () => {
  const robots = parseRobotsSitemaps("User-agent: *\nSitemap: https://example.com/sitemap.xml\n");
  assert.deepEqual(robots, ["https://example.com/sitemap.xml"]);
  const parsed = parseSitemapXml(`
    <sitemapindex>
      <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
    </sitemapindex>
    <urlset>
      <url><loc>https://example.com/a</loc></url>
    </urlset>
  `);
  assert.deepEqual(parsed.indexes, ["https://example.com/sitemap-pages.xml"]);
  assert.deepEqual(parsed.urls, ["https://example.com/a"]);
});

test("extractPage keeps heading path, skips chrome, and flags noindex", () => {
  const html = `<html><head>
    <title>Shop</title>
    <meta name="robots" content="noindex">
    <link rel="canonical" href="https://example.com/shop">
  </head>
  <body>
    <nav><a href="/about">About</a></nav>
    <h1>Hours</h1>
    <p>We are open weekdays for water heater replacement and leak repair visits.</p>
    <footer><p>Copyright 2026 Riverside. All rights reserved.</p></footer>
  </body></html>`;
  const page = extractPage(html, "https://example.com/shop");
  assert.equal(page.title, "Shop");
  assert.equal(page.noindex, true);
  assert.equal(page.canonical, "https://example.com/shop");
  assert.equal(page.internal_links.includes("https://example.com/about"), true);
  assert.equal(page.passages.length, 1);
  assert.equal(page.passages[0].location, "Hours > p[1]");
  assert.match(page.passages[0].text, /water heater/);
});

test("indexable filter drops redirects, errors, noindex, and canonical-elsewhere", () => {
  const base = {
    contentType: "text/html",
    robotsHeader: "",
    page: {
      noindex: false,
      canonical: "https://example.com/a",
      title: "A",
      headings: [],
      passages: []
    }
  };
  assert.equal(isIndexable({ ...base, status: 301 }, "https://example.com/a").reason, "redirect");
  assert.equal(isIndexable({ ...base, status: 404 }, "https://example.com/a").reason, "http_404");
  assert.equal(isIndexable({ ...base, status: 200, page: { ...base.page, noindex: true } }, "https://example.com/a").reason, "noindex");
  assert.equal(
    isIndexable({ ...base, status: 200, page: { ...base.page, canonical: "https://example.com/b" } }, "https://example.com/a").reason,
    "canonical_elsewhere"
  );
  assert.equal(isIndexable({ ...base, status: 200 }, "https://example.com/a").ok, true);
});

test("retrieval drops self and already-linked targets", () => {
  const pages = [
    {
      id: "p1",
      url: "https://example.com/",
      title: "Home",
      headings: ["Home"],
      passages: [],
      internal_links: ["https://example.com/services"]
    },
    {
      id: "p2",
      url: "https://example.com/services",
      title: "Plumbing Services",
      headings: ["Our services"],
      passages: [{ text: "Drain cleaning and water heater replacement." }]
    },
    {
      id: "p3",
      url: "https://example.com/drains",
      title: "Emergency drain cleaning",
      headings: ["Emergency drain cleaning"],
      passages: [{ text: "Hydro jetting for kitchen clogs." }]
    }
  ];
  const ranked = rankTargets(
    { heading_path: "Home", text: "Call for emergency drain cleaning after a storm." },
    pages[0],
    pages
  );
  const ids = ranked.map((row) => row.id);
  assert.equal(ids.includes("p1"), false);
  assert.equal(ids.includes("p2"), false);
  assert.equal(ids.includes("p3"), true);
});

test("anchor is a passage phrase that overlaps the target", () => {
  const anchor = suggestAnchor(
    "We handle emergency drain cleaning and leak repair for homes.",
    { title: "Emergency drain cleaning", headings: "Hydro jetting" }
  );
  assert.match(anchor.toLowerCase(), /drain cleaning/);
  assert.equal(BAD_ANCHOR_SAFE(anchor), false);
});

function BAD_ANCHOR_SAFE(value) {
  return /^(click here|learn more)$/i.test(value);
}

test("frozen Choice keeps no_link and gains candidate ids at runtime", () => {
  const frozen = loadFrozenQuestions();
  assert.equal(frozen.best_internal_link_target.type, "choice");
  assert.equal(Boolean(frozen.best_internal_link_target.criteria.no_link.what), true);
  const populated = populateQuestions(frozen, [
    { id: "p3", title: "Drain Cleaning", purpose: "Clear clogs" }
  ]);
  assert.equal(populated.best_internal_link_target.criteria.no_link.what.includes("None"), true);
  assert.equal(populated.best_internal_link_target.criteria.p3.what.includes("Drain Cleaning"), true);
  assert.equal(frozen.best_internal_link_target.criteria.p3, undefined);
});

test("stub scorer works with no API key and keeps a strong match", () => {
  const weak = stubScore([{ id: "p9", score: 0.04, title: "About" }]);
  assert.equal(weak.choice, "no_link");
  assert.equal(weak.model, "stub-local");
  const strong = stubScore([
    { id: "p3", score: 0.42, title: "Drain Cleaning" },
    { id: "p2", score: 0.11, title: "Services" }
  ]);
  assert.equal(strong.choice, "p3");
  assert.equal(strong.confidence >= CONFIDENCE_MIN, true);
  assert.equal(typeof strong.probabilities.p3, "number");
});

test("compileSuggestions keeps only confident non no_link rows", () => {
  const job = {
    source: { url: "https://example.com/" },
    passage: { location: "Home > p[1]", text: "Need emergency drain cleaning today." },
    candidates: [
      { id: "p3", url: "https://example.com/drains", title: "Emergency drain cleaning", headings: "", score: 0.4 }
    ]
  };
  const { suggestions, rejected } = compileSuggestions([
    { job, answer: { choice: "p3", confidence: 0.81, probabilities: { p3: 0.8, no_link: 0.2 }, model: "stub-local" } },
    { job, answer: { choice: "no_link", confidence: 0.9, probabilities: { no_link: 1 }, model: "stub-local" } },
    { job, answer: { choice: "p3", confidence: 0.4, probabilities: { p3: 0.4 }, model: "stub-local" } }
  ]);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].target_url, "https://example.com/drains");
  assert.match(suggestions[0].suggested_anchor.toLowerCase(), /drain/);
  assert.equal(rejected.length, 2);
});

test("reports write csv json and implement notes without secrets", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jev-link-"));
  const rows = [{
    source_url: "https://example.com/",
    passage_location: "Home > p[1]",
    passage_excerpt: "Need emergency drain cleaning today.",
    suggested_anchor: "emergency drain cleaning",
    target_url: "https://example.com/drains",
    confidence: 0.81,
    probabilities: { p3: 0.8, no_link: 0.2 }
  }];
  const files = writeReports(dir, rows, {
    startUrl: "https://example.com/",
    mode: "dry-run",
    model: "stub-local",
    indexableCount: 3,
    discoveredCount: 5,
    dropped: []
  });
  const csv = fs.readFileSync(files.csvPath, "utf8");
  const json = JSON.parse(fs.readFileSync(files.jsonPath, "utf8"));
  const md = fs.readFileSync(files.mdPath, "utf8");
  assert.match(csv, /source_url,passage_location/);
  assert.match(csv, /emergency drain cleaning/);
  assert.equal(json.suggestions.length, 1);
  assert.match(md, /Do not merge/);
  assert.match(md, /look-only/i);
  assert.equal(csv.toLowerCase().includes("jev_api_key"), false);
  assert.equal(JSON.stringify(json).toLowerCase().includes("bearer"), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("tfidf cosine is higher for overlapping documents", () => {
  const docs = [
    tokenize("emergency drain cleaning after a storm"),
    tokenize("emergency drain cleaning hydro jetting"),
    tokenize("family owned since nineteen ninety eight")
  ];
  const [query, close, far] = tfidfVectors(docs);
  assert.equal(cosine(query, close) > cosine(query, far), true);
});

test("crawl limits and user agent stay respectful", () => {
  assert.equal(PAGE_CAP, 500);
  assert.equal(CRAWL_CONCURRENCY, 4);
  assert.equal(FETCH_TIMEOUT_MS, 10_000);
  assert.match(USER_AGENT, /UmbyJevLink/);
  assert.match(USER_AGENT, /umby-jev-stack/);
});

test("runner does not load dotenv or commit-time key files", () => {
  const lib = fs.readFileSync(path.join(skillDir, "lib.mjs"), "utf8");
  const cli = fs.readFileSync(path.join(skillDir, "link.mjs"), "utf8");
  assert.equal(/dotenv|process\.env\.[A-Z0-9_]*KEY.*=/.test(lib), false);
  assert.equal(cli.includes("process.env.JEV_API_KEY"), true);
  assert.equal(cli.includes("--api-key"), false);
  assert.equal(fs.existsSync(path.join(skillDir, ".env")), false);
});

test("csv escapes commas and quotes", () => {
  const csv = toCsv([{
    source_url: "https://example.com/a",
    passage_location: "H1 > p[1]",
    passage_excerpt: "Hello, \"world\"",
    suggested_anchor: "world",
    target_url: "https://example.com/b",
    confidence: 0.9,
    probabilities: { p1: 1 }
  }]);
  assert.match(csv, /"Hello, ""world"""/);
});
