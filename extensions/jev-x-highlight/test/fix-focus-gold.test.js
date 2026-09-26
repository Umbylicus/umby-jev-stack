"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../lib/contract.js");
const runtime = require("../lib/runtime.js");
require("../lib/match.js");
const social = require("../social/content.js");
const { createDocument, h } = require("./minidom");

function state(features) {
  return runtime.mergeState({
    enabled: true,
    sites: { x: true },
    features,
    interests: ["fencing"],
    notInterests: ["soccer"]
  });
}

function dom() {
  const doc = createDocument();
  const el = (tag, props, ...children) => h(tag, Object.assign({ ownerDocument: doc }, props || {}), ...children);
  return { doc, el };
}

function tweet(el, id, author, text) {
  return el("article", { "data-testid": "tweet" },
    el("div", { "data-testid": "User-Name", text: author }),
    el("div", { "data-testid": "tweetText", text: text }),
    el("a", { href: "/status/" + id, text: "post" })
  );
}

test("focus without marks keeps interest full size and does not paint gold", () => {
  const { doc, el } = dom();
  const fencing = tweet(el, "101", "Ada", "fencing season");
  const soccer = tweet(el, "202", "Bea", "soccer highlights");
  const plain = tweet(el, "303", "Cam", "weather today");
  doc.body.append(fencing, soccer, plain);
  social.apply(doc, state({ focusDeclutter: true, highlight: false }), new Date(), "x.com");
  assert.equal(fencing.classList.contains("jev-gold"), false);
  assert.equal(fencing.classList.contains("jev-blur"), false);
  assert.equal(soccer.classList.contains("jev-blur"), true);
  assert.equal(soccer.classList.contains("jev-gold"), false);
  assert.equal(plain.classList.contains("jev-blur"), true);
  assert.equal(soccer.parentNode, doc.body);
  assert.equal(doc.querySelector(".jev-x"), null);
});

test("focus with marks still outlines an interest post", () => {
  const { doc, el } = dom();
  const fencing = tweet(el, "101", "Ada", "fencing season");
  const soccer = tweet(el, "202", "Bea", "soccer highlights");
  doc.body.append(fencing, soccer);
  social.apply(doc, state({
    focusDeclutter: true,
    highlight: true,
    workHours: false
  }), new Date(), "x.com");
  assert.equal(fencing.classList.contains("jev-gold"), true);
  assert.equal(soccer.classList.contains("jev-bad"), true);
  assert.equal(soccer.querySelector(".jev-x").textContent, "X");
});
