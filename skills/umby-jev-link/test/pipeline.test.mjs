"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  USER_AGENT,
  crawlSameHost,
  discoverSitemapUrls,
  extractCrawlLinks,
  runLinkInventory
} from "../lib.mjs";
import { startFixtureServer } from "../fixture.mjs";

const skillDir = path.dirname(fileURLToPath(new URL("../link.mjs", import.meta.url)));

test("sitemap discovery follows robots and a sitemap index", async () => {
  const fixture = await startFixtureServer();
  try {
    const urls = await discoverSitemapUrls(fixture.url);
    assert.equal(urls.some((url) => url.endsWith("/services.html")), true);
    assert.equal(urls.some((url) => url.endsWith("/thanks.html")), true);
    assert.equal(urls.length <= 500, true);
  } finally {
    await fixture.close();
  }
});

test("same-host crawl fallback stays on the fixture host", async () => {
  const fixture = await startFixtureServer();
  try {
    const pages = await crawlSameHost(fixture.url, { maxPages: 20 });
    const urls = pages.map((row) => row.url);
    assert.equal(urls.some((url) => url === fixture.url || url.endsWith("/")), true);
    assert.equal(urls.every((url) => url.startsWith(fixture.origin)), true);
    assert.equal(pages.some((row) => /Trusted plumbing/.test(row.html)), true);
  } finally {
    await fixture.close();
  }
});

test("dry-run against the fixture writes suggestions without a key", async () => {
  assert.equal(Boolean(process.env.JEV_API_KEY), false);
  const fixture = await startFixtureServer();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "jev-link-out-"));
  try {
    const result = await runLinkInventory({
      url: fixture.url,
      outDir,
      dryRun: true,
      apiKey: ""
    });
    assert.equal(result.mode, "dry-run");
    assert.equal(result.discovery, "sitemap");
    assert.equal(result.model, "stub-local");
    assert.equal(result.indexableCount >= 5, true);
    assert.equal(result.dropped.some((row) => row.reason === "noindex"), true);
    assert.equal(result.dropped.some((row) => row.reason === "canonical_elsewhere"), true);
    assert.equal(result.dropped.some((row) => row.reason === "http_404"), true);
    assert.equal(result.pages.some((page) => /thanks/i.test(page.url)), false);
    assert.equal(result.pages.some((page) => /old-drains/i.test(page.url)), false);
    assert.equal(result.suggestions.length >= 1, true);
    for (const row of result.suggestions) {
      assert.equal(row.confidence >= 0.7, true);
      assert.notEqual(row.choice, "no_link");
      assert.equal(Boolean(row.source_url && row.target_url && row.suggested_anchor), true);
      assert.notEqual(row.source_url, row.target_url);
    }
    const csv = fs.readFileSync(path.join(outDir, "links.csv"), "utf8");
    const json = JSON.parse(fs.readFileSync(path.join(outDir, "links.json"), "utf8"));
    const md = fs.readFileSync(path.join(outDir, "IMPLEMENT.md"), "utf8");
    assert.match(csv, /source_url/);
    assert.equal(json.suggestions.length, result.suggestions.length);
    assert.match(md, /human-approved/);
    assert.match(md, /Do not merge/);
  } finally {
    await fixture.close();
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("CLI --fixture dry-run exits 0 without JEV_API_KEY", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "jev-link-cli-"));
  const env = { ...process.env };
  delete env.JEV_API_KEY;
  const result = spawnSync(process.execPath, [path.join(skillDir, "link.mjs"), "--fixture", "--out", outDir], {
    encoding: "utf8",
    env
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /suggestions/);
  assert.equal(result.stdout.toLowerCase().includes("sk-"), false);
  assert.equal(fs.existsSync(path.join(outDir, "links.csv")), true);
  fs.rmSync(outDir, { recursive: true, force: true });
});

test("crawl link extractor ignores other hosts", () => {
  const html = `<a href="/about.html">About</a><a href="https://evil.test/x">x</a>`;
  const links = extractCrawlLinks(html, "https://example.com/", "https://example.com/");
  assert.deepEqual(links, ["https://example.com/about.html"]);
});

test("user agent is sent on fixture fetches", async () => {
  const seen = [];
  const fixture = await startFixtureServer();
  const fetchImpl = async (url, init) => {
    seen.push(init && init.headers && init.headers["User-Agent"]);
    return fetch(url, init);
  };
  try {
    await discoverSitemapUrls(fixture.url, { fetchImpl });
    assert.equal(seen.some((agent) => agent === USER_AGENT), true);
  } finally {
    await fixture.close();
  }
});
