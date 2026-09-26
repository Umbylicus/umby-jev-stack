"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const answer = require(path.join(__dirname, "..", "page", "answer.js"));
const { createDocument, h } = require(path.join(__dirname, "minidom.js"));

function listLike(items) {
  const nodes = { length: items.length };
  for (let i = 0; i < items.length; i++) nodes[i] = items[i];
  return nodes;
}

test("bodyAfter reads array-like childNodes and does not throw", () => {
  const heading = { nodeType: 1, tagName: "H2", textContent: "Shipping" };
  const paragraph = { nodeType: 1, tagName: "P", textContent: "Orders leave the warehouse in two days." };
  const next = { nodeType: 1, tagName: "H2", textContent: "Returns within thirty days." };
  const nodes = listLike([heading, paragraph, next]);
  assert.equal(typeof nodes.indexOf, "undefined");
  assert.equal(typeof nodes.slice, "undefined");
  heading.parentNode = { childNodes: nodes };
  assert.equal(answer.bodyAfter(heading), "Orders leave the warehouse in two days.");
});

test("bodyAfter separates sibling blocks instead of gluing words", () => {
  const heading = { nodeType: 1, tagName: "H2", textContent: "Shipping" };
  const first = { nodeType: 1, tagName: "P", textContent: "Orders leave" };
  const second = { nodeType: 1, tagName: "P", textContent: "the warehouse in two days." };
  const nodes = listLike([heading, first, second]);
  assert.equal(typeof nodes.indexOf, "undefined");
  heading.parentNode = { childNodes: nodes };
  assert.equal(answer.bodyAfter(heading), "Orders leave the warehouse in two days.");
});

test("bestSection selects the shipping heading from a minidom page", () => {
  const doc = createDocument();
  const heading = h("h2", { ownerDocument: doc, text: "Shipping" });
  const paragraph = h("p", { ownerDocument: doc, text: "Orders leave the warehouse in two days." });
  doc.body.append(heading, paragraph);
  const sections = [{
    title: heading.textContent,
    body: answer.bodyAfter(heading),
    el: heading
  }];
  const hit = answer.bestSection("Where is shipping?", sections);
  assert.ok(hit);
  assert.equal(sections[hit.index].el, heading);
  assert.equal(sections[hit.index].body, "Orders leave the warehouse in two days.");
  assert.ok(hit.score >= 0.34);
});
