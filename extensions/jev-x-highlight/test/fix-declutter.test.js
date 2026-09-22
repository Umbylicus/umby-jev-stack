"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../lib/contract.js");
require("../lib/runtime.js");
require("../lib/match.js");
const social = require("../social/content.js");
const { createDocument, h } = require("./minidom");

test("declutter hides Who to follow in a shared section and leaves About visible", () => {
  const doc = createDocument();
  const el = (tag, props, ...children) => h(tag, Object.assign({ ownerDocument: doc }, props || {}), ...children);
  const rail = el("h2", { text: "Who to follow" });
  const suggestion = el("div", { text: "@pat" });
  const about = el("h2", { text: "About" });
  const history = el("p", { text: "Company history" });
  const section = el("section", {}, rail, suggestion, about, history);
  doc.body.append(section);
  social.apply(doc, {
    enabled: true,
    sites: { x: true },
    features: { focusDeclutter: true, highlight: false }
  }, new Date(), "x.com");
  assert.equal(about.classList.contains("jev-hide"), false);
  assert.equal(history.classList.contains("jev-hide"), false);
  assert.equal(rail.classList.contains("jev-hide"), true);
  assert.equal(suggestion.classList.contains("jev-hide"), true);
  assert.equal(section.classList.contains("jev-hide"), false);
});
