"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../lib/contract.js");
require("../lib/runtime.js");
const steps = require("../page/steps.js");
const { createDocument, h } = require("./minidom.js");

function nodeList(items) {
  const list = { length: items.length };
  for (let i = 0; i < items.length; i++) list[i] = items[i];
  return list;
}

function makeElement(tag) {
  const el = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    className: "",
    parentNode: null,
    open: false,
    _kids: [],
    childNodes: nodeList([]),
    classList: {
      contains(name) {
        return el.className.split(/\s+/).filter(Boolean).includes(name);
      }
    },
    _sync() {
      this.childNodes = nodeList(this._kids);
    },
    _detach(node) {
      const index = this._kids.indexOf(node);
      if (index < 0) return;
      this._kids.splice(index, 1);
      if (node.parentNode === this) node.parentNode = null;
      this._sync();
    },
    append(node) {
      if (node.parentNode && node.parentNode._detach) node.parentNode._detach(node);
      this._kids.push(node);
      node.parentNode = this;
      this._sync();
    },
    insertBefore(node, anchor) {
      if (node.parentNode && node.parentNode._detach) node.parentNode._detach(node);
      const index = anchor ? this._kids.indexOf(anchor) : -1;
      if (index < 0) this._kids.push(node);
      else this._kids.splice(index, 0, node);
      node.parentNode = this;
      this._sync();
      return node;
    },
    remove() {
      if (this.parentNode && this.parentNode._detach) this.parentNode._detach(this);
      else this.parentNode = null;
    },
    hasAttribute(name) {
      return name === "open" && this.open === true;
    },
    set textContent(value) {
      this._text = String(value);
    },
    get textContent() {
      if (this._kids.length) return this._kids.map((node) => node.textContent || "").join("");
      return this._text || "";
    }
  };
  return el;
}

function assertNoSlice(list) {
  assert.equal(typeof list.slice, "undefined");
  assert.equal(typeof list.indexOf, "undefined");
  assert.equal(typeof list.length, "number");
}

test("collapse and restore accept childNodes without slice or indexOf", () => {
  assert.equal(typeof steps.collapse, "function");
  assert.equal(typeof steps.restore, "function");

  const parent = makeElement("div");
  const essay = makeElement("p");
  essay.textContent = "This essay introduces the tutorial.";
  const anchor = makeElement("ol");
  parent.append(essay);
  parent.append(anchor);

  const doc = {
    createElement(tag) {
      return makeElement(tag);
    },
    querySelectorAll(selector) {
      if (selector !== "details.jev-steps-intro") return [];
      const out = [];
      for (let i = 0; i < parent.childNodes.length; i++) {
        const node = parent.childNodes[i];
        if (node.nodeType === 1 && node.tagName === "DETAILS" && node.className === "jev-steps-intro") out.push(node);
      }
      return out;
    }
  };
  anchor.ownerDocument = doc;
  assertNoSlice(parent.childNodes);

  steps.collapse(anchor);
  const details = doc.querySelectorAll("details.jev-steps-intro")[0];
  assert.ok(details);
  assert.equal(details.hasAttribute("open"), false);
  assert.equal(details.childNodes[0].textContent, "Show the introduction");
  assert.equal(details.childNodes[0].tagName, "SUMMARY");
  assert.equal(essay.parentNode, details);
  assertNoSlice(details.childNodes);
  assertNoSlice(parent.childNodes);

  steps.restore(doc);
  assert.equal(doc.querySelectorAll("details.jev-steps-intro").length, 0);
  assert.equal(essay.parentNode, parent);
  assert.equal(parent.childNodes[0], essay);
  assert.equal(parent.childNodes[1], anchor);
});

test("sync puts the essay in a closed details and restores it when off", () => {
  const doc = createDocument();
  const paragraph = h("p", { ownerDocument: doc, text: "This essay introduces the tutorial." });
  const list = h(
    "ol",
    { ownerDocument: doc },
    h("li", { ownerDocument: doc, text: "One" }),
    h("li", { ownerDocument: doc, text: "Two" }),
    h("li", { ownerDocument: doc, text: "Three" })
  );
  doc.body.append(paragraph, list);
  global.document = doc;

  steps.sync({ enabled: true, features: { stepsOnly: true } });
  const details = doc.querySelector("details.jev-steps-intro");
  assert.ok(details);
  assert.equal(details.querySelector("summary").textContent, "Show the introduction");
  assert.equal(details.hasAttribute("open"), false);
  assert.equal(paragraph.parentElement, details);
  assert.equal(list.parentElement, doc.body);
  assert.equal(details.contains(list), false);

  steps.sync({ enabled: true, features: { stepsOnly: false } });
  assert.equal(doc.querySelector("details.jev-steps-intro"), null);
  assert.equal(paragraph.parentElement, doc.body);
  assert.equal(list.parentElement, doc.body);
  assert.equal(doc.body.children[0], paragraph);
  assert.equal(doc.body.children[1], list);
});
