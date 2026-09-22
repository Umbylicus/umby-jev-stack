"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

require(path.join(__dirname, "..", "lib", "contract.js"));
const { normalizeUrl, samePage, isPdfUrl } = require(path.join(__dirname, "..", "lib", "url.js"));

test("tracking params are ignored and the rest of the query is sorted", () => {
  const href = "https://WWW.Example.com/sale/?utm_source=x&fbclid=1&gclid=2&igshid=3&b=2&a=1#keep";
  assert.equal(normalizeUrl(href), "https://example.com/sale?a=1&b=2#keep");
  assert.equal(normalizeUrl("https://example.com/a?UTM_SOURCE=news&FBCLID=z&GCLID=q&IGSHID=p"), "https://example.com/a");
});

test("different paths are not the same page and the hash is kept", () => {
  assert.equal(samePage("https://example.com/a", "https://example.com/b"), false);
  assert.equal(samePage("https://example.com/docs#Section", "https://example.com/docs#Other"), false);
  assert.equal(normalizeUrl("https://www.Example.com/docs/?utm_source=a#Section"), "https://example.com/docs#Section");
});

test("www and host case do not matter", () => {
  assert.equal(samePage("https://WWW.Example.com/docs#Section", "https://example.com/docs/#Section"), true);
  assert.equal(samePage("https://www.Example.com/Path", "https://example.com/Path"), true);
  assert.equal(samePage("", ""), false);
  assert.equal(normalizeUrl(""), "");
  assert.equal(normalizeUrl("ftp://example.com/a"), "");
});

test("pdf urls look at the pathname before the query or hash", () => {
  assert.equal(isPdfUrl("https://cdn.example.com/files/Quote.PDF?utm_source=a#p=2"), true);
  assert.equal(isPdfUrl("https://example.com/file.pdfs"), false);
  assert.equal(isPdfUrl("https://example.com/pdf"), false);
  assert.equal(normalizeUrl("https://example.com:443/a/"), "https://example.com/a");
  assert.equal(normalizeUrl("http://example.com:80/"), "http://example.com/");
  assert.equal(normalizeUrl("https://example.com:8443/a"), "https://example.com:8443/a");
});
