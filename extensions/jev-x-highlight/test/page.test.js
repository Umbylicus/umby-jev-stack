"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
require(path.join(root, "lib", "contract.js"));
require(path.join(root, "lib", "runtime.js"));
require(path.join(root, "lib", "url.js"));
const draft = require(path.join(root, "page", "draft.js"));
const checkout = require(path.join(root, "page", "checkout.js"));
const steps = require(path.join(root, "page", "steps.js"));
const cookies = require(path.join(root, "page", "cookies.js"));
const decision = require(path.join(root, "page", "decision.js"));
const must = require(path.join(root, "page", "musthaves.js"));
const pdf = require(path.join(root, "page", "pdf.js"));
const job = require(path.join(root, "page", "jobfit.js"));
const cancel = require(path.join(root, "page", "cancel.js"));
const answer = require(path.join(root, "page", "answer.js"));
const duplicate = require(path.join(root, "page", "duplicate.js"));
const content = require(path.join(root, "page", "content.js"));
require(path.join(root, "pdf-viewer.js"));
const { createDocument, h } = require(path.join(root, "test", "minidom.js"));

function on(id, extra) {
  return Object.assign({ enabled: true, features: { [id]: true }, mustHaveText: "", jobCanDo: "" }, extra || {});
}

function off(id, extra) {
  return Object.assign({ enabled: true, features: { [id]: false }, mustHaveText: "", jobCanDo: "" }, extra || {});
}

function el(doc, tag, props) {
  const attrs = Object.assign({ ownerDocument: doc }, props || {});
  const children = Array.prototype.slice.call(arguments, 3);
  return h(tag, attrs, ...children);
}

function useDoc(doc) {
  global.document = doc;
}

test("draft promises flag price, date, and refund, and off does not mark", () => {
  const priced = draft.findPromises("$50 by Friday");
  assert.deepEqual(priced.map((item) => item.kind).sort(), ["date", "price"]);
  assert.equal(draft.findPromises("I will refund you")[0].kind, "refund");
  assert.deepEqual(draft.findPromises("hello there"), []);

  delete global.CSS;
  delete global.Highlight;
  const doc = createDocument();
  const box = el(doc, "textarea");
  box.value = "$50 by Friday";
  doc.body.append(box);
  useDoc(doc);
  let sets = 0;
  global.CSS = {
    highlights: {
      set() { sets += 1; },
      delete() {}
    }
  };
  global.Highlight = function Highlight() {};
  draft.sync(off("draftCheck"));
  assert.equal(sets, 0);
  assert.equal(doc.getElementById("jev-draft-note"), null);
  delete global.CSS;
  delete global.Highlight;
});

test("draft note follows the composer until the feature is turned off", () => {
  delete global.CSS;
  delete global.Highlight;
  const doc = createDocument();
  const box = el(doc, "textarea");
  const search = el(doc, "textarea", { "aria-label": "Search" });
  box.value = "hello there";
  search.value = "$50 by Friday";
  doc.body.append(box, search);
  useDoc(doc);
  draft.sync(on("draftCheck"));
  assert.equal(doc.getElementById("jev-draft-note"), null);
  box.value = "I will refund you";
  box.dispatchEvent("input");
  assert.match(doc.getElementById("jev-draft-note").textContent, /refund/);
  draft.sync(off("draftCheck"));
  assert.equal(doc.getElementById("jev-draft-note"), null);
  box.value = "$50 by Friday";
  box.dispatchEvent("input");
  assert.equal(doc.getElementById("jev-draft-note"), null);
});

test("draft uses the jev-draft highlight and does not rewrite the composer", () => {
  const doc = createDocument();
  const editor = el(doc, "div", { contenteditable: "true" });
  editor.append(doc.createTextNode("$50 by Friday"));
  doc.body.append(editor);
  doc.createRange = function () {
    return {
      setStart() {},
      setEnd() {}
    };
  };
  let name = "";
  global.Highlight = function Highlight() {};
  global.CSS = { highlights: { set(next) { name = next; }, delete() { name = ""; } } };
  useDoc(doc);
  draft.sync(on("draftCheck"));
  assert.equal(name, "jev-draft");
  assert.equal(editor.textContent, "$50 by Friday");
  assert.equal(doc.getElementById("jev-draft-note"), null);
  draft.sync(off("draftCheck"));
  assert.equal(name, "");
  delete global.CSS;
  delete global.Highlight;
});

test("checkout brand Nike mismatches a lookalike host and not nike.com", () => {
  assert.equal(checkout.mismatches("Nike", "nike-deals.shop"), true);
  assert.equal(checkout.mismatches("Nike", "nike.com"), false);
  assert.equal(checkout.mismatches("Nike", "www.nike.com"), false);
  assert.equal(checkout.mismatches("Nike", "nike.com.evil.example"), true);
  assert.equal(checkout.mismatches("Coca-Cola", "coca-cola.com"), false);
  assert.equal(checkout.mismatches("Home Depot", "homedepot.com"), false);
  assert.equal(checkout.mismatches("Secure checkout", "nike.com"), false);
  assert.equal(checkout.mismatches("", "nike-deals.shop"), false);
  assert.equal(checkout.isPayPage({ href: "https://nike-deals.shop/checkout", text: "" }), true);

  const doc = createDocument();
  doc.location = { href: "https://nike-deals.shop/checkout", hostname: "nike-deals.shop" };
  doc.head.append(el(doc, "meta", { property: "og:site_name", content: "Nike" }));
  useDoc(doc);
  checkout.sync(on("checkoutDomain"));
  assert.match(doc.body.textContent, /This pay page does not match the brand in the header\./);
  doc.location = { href: "https://nike.com/checkout", hostname: "nike.com" };
  checkout.sync(on("checkoutDomain"));
  assert.equal(doc.body.textContent.includes("This pay page does not match the brand in the header."), false);
  doc.location = { href: "https://nike-deals.shop/checkout", hostname: "nike-deals.shop" };
  checkout.sync(on("checkoutDomain"));
  checkout.sync(off("checkoutDomain"));
  assert.equal(doc.querySelector(".jev-card"), null);
});

test("steps hide the essay above a three-step list and restore it when off", () => {
  const doc = createDocument();
  const paragraph = el(doc, "p", { text: "This essay introduces the tutorial." });
  const list = el(
    doc,
    "ol",
    {},
    el(doc, "li", { text: "One" }),
    el(doc, "li", { text: "Two" }),
    el(doc, "li", { text: "Three" })
  );
  doc.body.append(paragraph, list);
  useDoc(doc);
  steps.sync(on("stepsOnly"));
  const details = doc.querySelector("details");
  assert.ok(details);
  assert.equal(details.querySelector("summary").textContent, "Show the introduction");
  assert.equal(details.hasAttribute("open"), false);
  assert.equal(paragraph.parentElement, details);
  assert.equal(list.parentElement, doc.body);
  assert.equal(details.contains(list), false);
  steps.sync(off("stepsOnly"));
  assert.equal(doc.querySelector("details"), null);
  assert.equal(paragraph.parentElement, doc.body);
  assert.equal(list.parentElement, doc.body);
  assert.equal(doc.body.children[0], paragraph);
  assert.equal(doc.body.children[1], list);

  const plain = createDocument();
  const only = el(plain, "p", { text: "No steps here." });
  plain.body.append(only);
  useDoc(plain);
  steps.sync(on("stepsOnly"));
  assert.equal(only.parentElement, plain.body);
  assert.equal(plain.querySelector("details"), null);
});

test("reject labels are outlined and accept is not, with no click", () => {
  assert.equal(fs.readFileSync(path.join(root, "page", "cookies.js"), "utf8").includes(".click("), false);
  assert.equal(fs.readFileSync(path.join(root, "page", "cookies.js"), "utf8").includes("addEventListener"), false);
  const doc = createDocument();
  const reject = el(doc, "button", { text: "Reject all" });
  const cookiesButton = el(doc, "button", { text: "Reject cookies" });
  const accept = el(doc, "button", { text: "Accept all" });
  const allow = el(doc, "a", { text: "Allow" });
  doc.body.append(reject, cookiesButton, accept, allow);
  useDoc(doc);
  cookies.sync(on("rejectCookies"));
  assert.equal(reject.classList.contains("jev-reject"), true);
  assert.equal(cookiesButton.classList.contains("jev-reject"), true);
  assert.equal(accept.classList.contains("jev-reject"), false);
  assert.equal(allow.classList.contains("jev-reject"), false);
  assert.equal(reject.listeners.click, undefined);
  cookies.sync(off("rejectCookies"));
  assert.equal(reject.classList.contains("jev-reject"), false);
  assert.equal(cookies.isRejectLabel("Essential only"), true);
  assert.equal(cookies.isRejectLabel("Allow"), false);
});

test("a decision line names the owner and date without inventing today", () => {
  const named = decision.line("Dana will approve the refund on Friday.", new Date("2031-01-02T00:00:00Z"));
  assert.match(named, /Decision:/);
  assert.match(named, /Owner: Dana/);
  assert.match(named, /Date: Friday/);
  assert.equal(named.includes("\n"), false);
  assert.equal(named.includes("2031"), false);
  const plain = decision.line("Please remember to water the plants near the gate this season.", new Date("2031-01-02T00:00:00Z"));
  assert.match(plain, /Owner: unknown/);
  assert.match(plain, /Date: none/);
  assert.equal(plain.includes("\n"), false);
  assert.equal(plain.includes("2031"), false);

  const doc = createDocument();
  const sentence = "Dana will approve the refund on Friday and send the receipt.";
  doc.defaultView.getSelection = function () {
    return { toString: function () { return sentence; }, rangeCount: 1 };
  };
  let copied = "";
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(global, "navigator");
  Object.defineProperty(global, "navigator", {
    configurable: true,
    writable: true,
    value: {
      clipboard: {
        writeText(value) {
          copied = value;
          return Promise.resolve();
        }
      }
    }
  });
  try {
    useDoc(doc);
    decision.sync(on("decisionLine"));
    doc.documentElement.dispatchEvent("mouseup");
    const card = doc.getElementById("jev-decision-card");
    assert.ok(card);
    assert.equal(card.querySelector("p").textContent.includes("\n"), false);
    assert.equal(card.querySelector("button").textContent, "Copy");
    card.querySelector("button").dispatchEvent("click");
    assert.equal(copied, card.querySelector("p").textContent);
    decision.sync(off("decisionLine"));
    assert.equal(doc.getElementById("jev-decision-card"), null);
  } finally {
    Object.defineProperty(global, "navigator", navigatorDescriptor);
  }
});

test("must-haves fail only the spec rows that miss the limit", () => {
  assert.equal(must.rowFails("under 20 lb", "Weight 25 lb"), true);
  assert.equal(must.rowFails("under 20 lb", "Weight 10 lb"), false);
  assert.equal(must.rowFails("under 20 lb", "Color red"), false);
  assert.equal(must.rowFails("works on 120V", "Voltage 240 V"), true);
  assert.equal(must.rowFails("works on 120V", "120V"), false);
  assert.equal(must.rowFails("works on 120V", "110-120V"), false);
  assert.equal(must.rowFails("works on 120V", "Weight 25 lb"), false);
  assert.equal(must.rowFails("under $50", "$80"), true);
  assert.equal(must.rowFails("under $50", "$20"), false);

  const doc = createDocument();
  doc.location = { href: "https://shop.example/dp/B00", hostname: "shop.example" };
  const heavy = el(doc, "tr", { text: "Weight 25 lb" });
  const light = el(doc, "tr", { text: "Weight 10 lb" });
  const color = el(doc, "tr", { text: "Color red" });
  const wrongVolts = el(doc, "tr", { text: "Voltage 240 V" });
  const rightVolts = el(doc, "tr", { text: "120V" });
  const rangeVolts = el(doc, "tr", { text: "110-120V" });
  const pricey = el(doc, "li", { text: "$80" });
  const cheap = el(doc, "li", { text: "$20" });
  const blurb = el(doc, "p", { text: "$80" });
  doc.body.append(heavy, light, color, wrongVolts, rightVolts, rangeVolts, pricey, cheap, blurb);
  useDoc(doc);
  const state = on("mustHaves", { mustHaveText: "under 20 lb, works on 120V\nunder $50" });
  must.sync(state);
  assert.equal(heavy.classList.contains("jev-fail"), true);
  assert.equal(light.classList.contains("jev-fail"), false);
  assert.equal(color.classList.contains("jev-fail"), false);
  assert.equal(wrongVolts.classList.contains("jev-fail"), true);
  assert.equal(rightVolts.classList.contains("jev-fail"), false);
  assert.equal(rangeVolts.classList.contains("jev-fail"), false);
  assert.equal(pricey.classList.contains("jev-fail"), true);
  assert.equal(cheap.classList.contains("jev-fail"), false);
  assert.equal(blurb.classList.contains("jev-fail"), false);
  must.sync(off("mustHaves", { mustHaveText: state.mustHaveText }));
  assert.equal(heavy.classList.contains("jev-fail"), false);
  assert.equal(wrongVolts.classList.contains("jev-fail"), false);
  assert.equal(pricey.classList.contains("jev-fail"), false);
});

test("pdf text keeps amounts and signature lines from an uncompressed stream", () => {
  const sample = [
    "%PDF-1.1",
    "1 0 obj",
    "<< /Length 64 >>",
    "stream",
    "BT (Total $42.00) Tj T* (Signature ______) Tj ET",
    "endstream",
    "endobj",
    "trailer << >>",
    "%%EOF"
  ].join("\n");
  const text = pdf.extractPdfText(sample);
  assert.ok(text.includes("Total $42.00"));
  assert.ok(text.includes("Signature ______"));
  const bytes = new TextEncoder().encode(sample);
  assert.ok(pdf.extractPdfText(bytes).includes("$42.00"));
  const amounts = pdf.findAmounts("Total $42.00 plus USD 40 and €20");
  assert.ok(amounts.includes("$42.00"));
  assert.ok(amounts.includes("USD 40"));
  assert.ok(amounts.includes("€20"));
  assert.ok(pdf.findAmounts(text).some((amount) => amount.includes("$42.00")));
  assert.ok(pdf.findSignatures(text).some((line) => /signature/i.test(line)));
  assert.deepEqual(pdf.findSignatures("Name\n____________"), ["____________"]);
  assert.equal(/\beval\s*\(/.test(fs.readFileSync(path.join(root, "page", "pdf.js"), "utf8")), false);
  assert.equal(/\beval\s*\(/.test(fs.readFileSync(path.join(root, "pdf-viewer.js"), "utf8")), false);
  assert.equal(fs.existsSync(path.join(root, "vendor", "pdfjs", "pdf.min.js")), true);
  assert.equal(fs.existsSync(path.join(root, "vendor", "pdfjs", "pdf.worker.min.js")), true);
});

test("job fit golds a can-do phrase, reds other requirements, and clears when off", () => {
  assert.equal(job.judge("Experience with forklifts", ["forklifts"]), "gold");
  assert.equal(job.judge("Must have a CDL", ["forklifts"]), "bad");
  assert.equal(job.judge("Must have a CDL", []), "skip");
  assert.equal(job.judge("Must have a CDL", ""), "skip");
  assert.deepEqual(job.parseCanDo("forklifts, pallet jacks\nexcel"), ["forklifts", "pallet jacks", "excel"]);

  const doc = createDocument();
  doc.location = { href: "https://example.com/jobs/1", hostname: "example.com" };
  const good = el(doc, "li", { text: "Experience with forklifts" });
  const bad = el(doc, "li", { text: "Must have a CDL" });
  const snack = el(doc, "li", { text: "We offer snacks in the break room" });
  doc.body.append(el(doc, "h1", { text: "Job" }), good, bad, snack);
  useDoc(doc);
  job.sync(on("jobFit", { jobCanDo: "forklifts" }));
  assert.equal(good.classList.contains("jev-pass"), true);
  assert.equal(bad.classList.contains("jev-fail"), true);
  assert.equal(snack.classList.contains("jev-pass") || snack.classList.contains("jev-fail"), false);
  job.sync(on("jobFit", { jobCanDo: "" }));
  assert.equal(good.classList.contains("jev-pass"), false);
  assert.equal(bad.classList.contains("jev-fail"), false);
  job.sync(on("jobFit", { jobCanDo: "forklifts" }));
  job.sync(off("jobFit", { jobCanDo: "forklifts" }));
  assert.equal(good.classList.contains("jev-pass"), false);
  assert.equal(bad.classList.contains("jev-fail"), false);
});

test("help me cancel ranks controls, glows the earliest, and does not click it", () => {
  assert.equal(cancel.rankControl("Confirm cancellation"), 5);
  assert.equal(cancel.rankControl("Finish cancellation"), 5);
  assert.equal(cancel.rankControl("Yes, cancel"), 5);
  assert.equal(cancel.rankControl("Why are you leaving"), 3);
  assert.equal(cancel.rankControl("Reason"), 3);
  assert.equal(cancel.rankControl("Continue"), 4);
  assert.equal(cancel.rankControl("Next"), 4);
  assert.equal(cancel.rankControl("Manage subscription"), 1);
  assert.equal(cancel.rankControl("Billing"), 1);
  assert.equal(cancel.rankControl("Membership"), 1);
  assert.equal(cancel.rankControl("Cancel subscription"), 2);
  assert.equal(cancel.rankControl("End subscription"), 2);
  assert.equal(cancel.rankControl("Close account"), 2);
  assert.equal(cancel.rankControl("Save changes"), 0);
  assert.notEqual(cancel.rankControl("Confirm cancellation"), 2);
  assert.equal(fs.readFileSync(path.join(root, "page", "cancel.js"), "utf8").includes(".click("), false);

  const doc = createDocument();
  const confirm = el(doc, "button", { text: "Confirm cancellation" });
  const manage = el(doc, "button", { text: "Manage subscription" });
  const next = el(doc, "button", { text: "Continue" });
  doc.body.append(confirm, manage, next);
  let clicks = 0;
  for (const control of [confirm, manage, next]) {
    const original = control.click.bind(control);
    control.click = function () {
      clicks += 1;
      original();
    };
  }
  useDoc(doc);
  cancel.sync(on("helpCancel"));
  const help = doc.getElementById("jev-help-cancel");
  assert.equal(help.textContent, "Help me cancel");
  help.click();
  assert.equal(clicks, 0);
  assert.equal(confirm.classList.contains("jev-glow"), true);
  assert.equal(manage.classList.contains("jev-glow"), false);
  confirm.dispatchEvent("click");
  assert.equal(clicks, 0);
  assert.equal(confirm.classList.contains("jev-glow"), false);
  assert.equal(manage.classList.contains("jev-glow"), true);
  manage.dispatchEvent("click");
  assert.equal(next.classList.contains("jev-glow"), true);
  next.dispatchEvent("click");
  assert.equal(doc.querySelector(".jev-glow"), null);
  cancel.sync(on("helpCancel"));
  doc.getElementById("jev-help-cancel").click();
  assert.equal(confirm.classList.contains("jev-glow"), true);
  cancel.sync(off("helpCancel"));
  assert.equal(doc.getElementById("jev-help-cancel"), null);
  assert.equal(doc.querySelector(".jev-glow"), null);
});

test("answer jump matches shipping and ignores nonsense", () => {
  const sections = [
    { title: "Introduction", body: "Welcome to the company handbook." },
    { title: "Shipping", body: "Orders leave the warehouse in two days." }
  ];
  const hit = answer.bestSection("Where is shipping?", sections);
  assert.equal(hit.index, 1);
  assert.ok(hit.score >= 0.34);
  assert.equal(answer.bestSection("zzzz quantum blorp", sections), null);
  assert.equal(answer.bestSection("shipping packaging policies extras", [{ title: "Shipping", body: "Fast" }]), null);

  const doc = createDocument();
  const intro = el(doc, "h2", { text: "Introduction" });
  const shipping = el(doc, "h2", { text: "Shipping" });
  let scrolled = "";
  intro.scrollIntoView = function () { scrolled = "intro"; };
  shipping.scrollIntoView = function () { scrolled = "shipping"; };
  doc.body.append(intro, el(doc, "p", { text: "Welcome to our story." }), shipping, el(doc, "p", { text: "Ships in two days." }));
  let fetched = false;
  global.fetch = function () {
    fetched = true;
    throw new Error("network");
  };
  useDoc(doc);
  answer.sync(on("answerJump"));
  const field = doc.getElementById("jev-answer-q");
  const button = Array.from(doc.querySelectorAll("button")).find((node) => node.textContent === "Show section");
  field.value = "Where is shipping?";
  button.dispatchEvent("click");
  assert.equal(scrolled, "shipping");
  assert.equal(fetched, false);
  field.value = "zzzz quantum blorp";
  button.dispatchEvent("click");
  assert.match(doc.getElementById("jev-answer-card").textContent, /No section matches that question\./);
  answer.sync(off("answerJump"));
  assert.equal(doc.getElementById("jev-answer-card"), null);
  delete global.fetch;
});

test("duplicate card offers close and ignore, and stays away when the feature is off", () => {
  const doc = createDocument();
  const listeners = [];
  const sent = [];
  global.chrome = {
    runtime: {
      onMessage: {
        addListener(fn) { listeners.push(fn); },
        removeListener(fn) {
          const at = listeners.indexOf(fn);
          if (at >= 0) listeners.splice(at, 1);
        }
      },
      sendMessage(message) { sent.push(message); }
    }
  };
  useDoc(doc);
  duplicate.sync(on("duplicateSite"));
  duplicate.sync(on("duplicateSite"));
  assert.equal(listeners.length, 1);
  listeners[0]({ type: global.JEV.MSG.DUPLICATE, originalTabId: 7, url: "https://example.com/a" });
  assert.equal(doc.body.textContent.includes("This is already open."), true);
  const close = Array.from(doc.querySelectorAll("button")).find((node) => node.textContent === "Close and go to original");
  const ignore = Array.from(doc.querySelectorAll("button")).find((node) => node.textContent === "Ignore");
  close.dispatchEvent("click");
  assert.deepEqual(sent[0], { type: global.JEV.MSG.DUPLICATE_CLOSE, originalTabId: 7 });
  ignore.dispatchEvent("click");
  assert.equal(sent[sent.length - 1].type, global.JEV.MSG.DUPLICATE_IGNORE);
  assert.equal(doc.body.textContent.includes("This is already open."), false);
  listeners[0]({ type: global.JEV.MSG.DUPLICATE, originalTabId: 9, url: "https://example.com/a" });
  assert.equal(doc.body.textContent.includes("This is already open."), true);
  duplicate.sync(off("duplicateSite"));
  assert.equal(doc.body.textContent.includes("This is already open."), false);
  listeners[0]({ type: global.JEV.MSG.DUPLICATE, originalTabId: 9, url: "https://example.com/a" });
  assert.equal(doc.body.textContent.includes("This is already open."), false);
  delete global.chrome;
});

test("content syncs every page tool only after an extension id exists", () => {
  const previousDocument = global.document;
  const previousChrome = global.chrome;
  const previousWatch = global.JEV.watchState;
  delete global.document;
  global.chrome = { runtime: {} };
  content.boot();
  global.document = createDocument();
  content.boot();
  const calls = [];
  global.JEV.watchState = function (callback) {
    calls.push(callback);
    return function () {};
  };
  global.chrome = { runtime: { id: "abc" } };
  content.boot();
  content.boot();
  assert.equal(calls.length, 1);
  const seen = [];
  const names = ["JEVDraft", "JEVCheckout", "JEVSteps", "JEVCookies", "JEVDecision", "JEVMust", "JEVPdf", "JEVJob", "JEVCancel", "JEVAnswer", "JEVDuplicate"];
  const saved = {};
  for (const name of names) {
    saved[name] = global[name];
    global[name] = { sync(state) { seen.push([name, state.enabled]); } };
  }
  content.syncAll({ enabled: true });
  assert.deepEqual(seen.map((item) => item[0]), names);
  for (const name of names) global[name] = saved[name];
  global.document = previousDocument;
  global.chrome = previousChrome;
  global.JEV.watchState = previousWatch;
});
