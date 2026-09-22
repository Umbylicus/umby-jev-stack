"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.join(__dirname, "..");
require(path.join(root, "lib", "contract.js"));
require(path.join(root, "lib", "runtime.js"));
const must = require(path.join(root, "page", "musthaves.js"));
const { createDocument, h } = require(path.join(root, "test", "minidom.js"));

function on(id, extra) {
  return Object.assign({ enabled: true, features: { [id]: true }, mustHaveText: "", jobCanDo: "" }, extra || {});
}

function off(id, extra) {
  return Object.assign({ enabled: true, features: { [id]: false }, mustHaveText: "", jobCanDo: "" }, extra || {});
}

test("rowText reads a dt label from array-like children without indexOf", () => {
  const dt = { tagName: "DT", textContent: "Weight" };
  const dd = { tagName: "DD", textContent: "25 lb" };
  const children = { 0: dt, 1: dd, length: 2 };
  assert.equal(typeof children.indexOf, "undefined");
  dd.parentElement = { tagName: "DL", children: children };
  assert.equal(must.rowText(dd), "Weight 25 lb");
});

test("must-haves mark only the heavy dd on a product page", () => {
  assert.equal(must.rowFails("under 20 lb", "Weight 25 lb"), true);
  assert.equal(must.rowFails("under 20 lb", "Weight 10 lb"), false);
  assert.equal(must.rowFails("under 20 lb", "Color red"), false);

  const doc = createDocument();
  doc.location = { href: "https://shop.example/item/1", hostname: "shop.example" };
  const heavy = h("dd", { ownerDocument: doc, text: "25 lb" });
  const light = h("dd", { ownerDocument: doc, text: "10 lb" });
  const color = h("dd", { ownerDocument: doc, text: "red" });
  const dl = h("dl", { ownerDocument: doc },
    h("dt", { ownerDocument: doc, text: "Weight" }),
    heavy,
    h("dt", { ownerDocument: doc, text: "Weight" }),
    light,
    h("dt", { ownerDocument: doc, text: "Color" }),
    color
  );
  doc.body.append(h("button", { ownerDocument: doc, text: "Add to cart" }), dl);
  global.document = doc;
  const state = on("mustHaves", { mustHaveText: "under 20 lb" });
  must.sync(state);
  assert.equal(heavy.classList.contains("jev-fail"), true);
  assert.equal(light.classList.contains("jev-fail"), false);
  assert.equal(color.classList.contains("jev-fail"), false);
  must.sync(off("mustHaves", { mustHaveText: state.mustHaveText }));
  assert.equal(heavy.classList.contains("jev-fail"), false);
});
