"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { createDocument } = require(path.join(__dirname, "minidom.js"));

const root = path.join(__dirname, "..");
require(path.join(root, "lib", "contract.js"));
const runtime = require(path.join(root, "lib", "runtime.js"));
require(path.join(root, "docs", "terms.js"));
const proposal = require(path.join(root, "docs", "proposal.js"));
require(path.join(root, "docs", "fill.js"));
require(path.join(root, "docs", "content.js"));

const TERMS_TEXT = [
  "The plan will auto-renew unless you stop it.",
  "You can cancel within the 14-day cancellation window.",
  "All disputes go to binding arbitration and you waive jury trial.",
  "We sell your data to analytics buyers.",
  "A random warranty covers manufacturing defects for one year."
].join(" ");

const PROPOSAL_A = [
  "Fees",
  "The total price is $500. The vendor shall deliver support.",
  "",
  "Term",
  "The initial term is 12 months.",
  "",
  "Liability",
  "Total liability shall not exceed $100.",
  "",
  "Scope",
  "The vendor shall provide weekly reports at a price of $500.",
  "",
  "Risk",
  "The vendor shall indemnify the client."
].join("\n");

const PROPOSAL_B = [
  "Fees",
  "The total price is $800. The vendor will deliver support.",
  "",
  "Term",
  "The initial term is 6 months.",
  "",
  "Liability",
  "Total liability will not exceed $2000.",
  "",
  "Scope",
  "The vendor will provide weekly reports at a price of $500.",
  "",
  "Risk",
  "The vendor will indemnify the client."
].join("\n");

function mount(href, title, heading) {
  const document = createDocument();
  globalThis.document = document;
  document.title = title || "";
  document.location = { href: href || "https://example.com/" };
  if (heading) {
    const h1 = document.createElement("h1");
    h1.textContent = heading;
    document.body.appendChild(h1);
  }
  return document;
}

function stateWith(features, extra) {
  return runtime.mergeState(Object.assign({ enabled: true, features: features || {} }, extra || {}));
}

function termsCard(document) {
  return document.getElementById("jev-terms");
}

function addField(document, id, type, name, labelText) {
  const label = document.createElement("label");
  label.setAttribute("for", id);
  label.textContent = labelText;
  const input = document.createElement("input");
  input.setAttribute("id", id);
  input.setAttribute("type", type);
  input.setAttribute("name", name);
  document.body.append(label, input);
  return input;
}

function rowByLabel(card, label) {
  return [...card.querySelectorAll(".jev-fill-row")].find((row) => {
    const span = row.querySelector("span");
    return span && span.textContent === label;
  });
}

test("terms extract keeps the four topics and drops a warranty sentence", () => {
  const found = globalThis.JEVTerms.extract(TERMS_TEXT);
  assert.match(found.autoRenew.join(" "), /auto-renew/i);
  assert.match(found.cancellation.join(" "), /14-day cancellation window|cancel within/i);
  assert.match(found.arbitration.join(" "), /arbitration/i);
  assert.match(found.dataSold.join(" "), /sell your data/i);
  for (const key of ["autoRenew", "cancellation", "arbitration", "dataSold"]) {
    assert.ok(found[key].length <= 2);
    for (const line of found[key]) {
      assert.ok(line.length <= 240);
      assert.doesNotMatch(line, /warranty/i);
    }
  }
  assert.equal(globalThis.JEVTerms.isTermsPage({ href: "https://example.com/cookie-policy", title: "", heading: "" }), true);
  assert.equal(globalThis.JEVTerms.isTermsPage({ href: "https://example.com/legal-notice", title: "", heading: "" }), true);
  assert.equal(globalThis.JEVTerms.isTermsPage({ href: "https://example.com/about", title: "About", heading: "Hello" }), false);
});

test("a page that is not terms gets no card", () => {
  const document = mount("https://example.com/picnic", "Picnic checklist", "Packing list");
  document.body.appendChild(document.createTextNode("\n" + TERMS_TEXT));
  globalThis.JEVTerms.sync(stateWith({ termsCard: true }));
  assert.equal(termsCard(document), null);
  assert.equal(document.querySelector(".jev-card"), null);
});

test("feature off removes the terms card", () => {
  const document = mount("https://example.com/privacy", "Privacy policy", "Privacy policy");
  document.body.appendChild(document.createTextNode("\n" + TERMS_TEXT));
  const state = stateWith({ termsCard: true });
  globalThis.JEVTerms.sync(state);
  const card = termsCard(document);
  assert.ok(card);
  assert.match(card.textContent, /Terms/);
  assert.deepEqual(
    [...card.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((el) => el.textContent),
    ["Auto-renew", "Cancellation window", "Arbitration", "Data sold"]
  );
  assert.match(card.textContent, /auto-renew/i);
  assert.match(card.textContent, /14-day/);
  assert.match(card.textContent, /arbitration/i);
  assert.match(card.textContent, /sell your data/i);
  assert.doesNotMatch(card.textContent, /warranty/i);
  state.features.termsCard = false;
  globalThis.JEVTerms.sync(state);
  assert.equal(termsCard(document), null);
});

test("empty terms buckets say None found", () => {
  const document = mount("https://example.com/legal-notice", "Legal notice", "Legal notice");
  document.body.appendChild(document.createTextNode("\nWe respect your visit."));
  globalThis.JEVTerms.sync(stateWith({ termsCard: true }));
  const card = termsCard(document);
  assert.equal(card.textContent.split("None found").length - 1, 4);
});

test("diffProposals reports price, term, and liability only", () => {
  const diffs = proposal.diffProposals(PROPOSAL_A, PROPOSAL_B);
  assert.deepEqual(diffs.map((diff) => diff.change), ["price", "term", "liability"]);
  assert.deepEqual(diffs.map((diff) => diff.heading), ["Fees", "Term", "Liability"]);
  assert.match(diffs[0].before, /\$500/);
  assert.match(diffs[0].after, /\$800/);
  assert.match(diffs[1].before, /12 months/);
  assert.match(diffs[1].after, /6 months/);
  assert.match(diffs[2].before, /\$100/);
  assert.match(diffs[2].after, /\$2000/);
  assert.equal(diffs.some((diff) => diff.heading === "Scope" || diff.heading === "Risk"), false);
  assert.equal(globalThis.JEVProposal.diffProposals, proposal.diffProposals);
});

test("proposal sync sends the page text without extension cards", () => {
  const document = mount("https://vendor.example/proposal/2", "Proposal", "Proposal");
  const noise = document.createElement("aside");
  noise.className = "jev-card";
  noise.textContent = "Card price $999";
  const copy = document.createElement("p");
  copy.textContent = "The total price is $500.";
  document.body.append(noise, copy);
  const sent = [];
  globalThis.chrome = {
    runtime: {
      id: "docs-test",
      sendMessage(message, callback) {
        sent.push(message);
        if (typeof callback === "function") callback({ waiting: true });
      }
    }
  };
  try {
    const state = stateWith({ proposalDiff: true });
    globalThis.JEVProposal.sync(state);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].type, globalThis.JEV.MSG.PROPOSAL);
    assert.equal(sent[0].title, "Proposal");
    assert.equal(sent[0].href, "https://vendor.example/proposal/2");
    assert.match(sent[0].text, /\$500/);
    assert.doesNotMatch(sent[0].text, /\$999/);
    assert.equal(
      document.getElementById("jev-proposal").textContent.trim(),
      "Open a second proposal or contract to compare."
    );
    assert.equal(document.body.contains(noise), true);
    state.features.proposalDiff = false;
    globalThis.JEVProposal.sync(state);
    assert.equal(sent.length, 1);
    assert.equal(document.getElementById("jev-proposal"), null);
  } finally {
    delete globalThis.chrome;
  }
});

test("waiting text when only one proposal is open", () => {
  const document = mount("https://example.com/proposal/1", "Proposal", "Proposal");
  globalThis.JEVProposal.render({ waiting: true });
  const card = document.getElementById("jev-proposal");
  assert.ok(card);
  assert.equal(card.textContent.trim(), "Open a second proposal or contract to compare.");
  globalThis.JEVProposal.render({ diffs: [] });
  assert.equal(document.getElementById("jev-proposal").textContent.trim(), "No price, term, or liability changes.");
});

test("classifyField maps contact roles and rejects a password", () => {
  const fill = globalThis.JEVFill;
  assert.equal(fill.classifyField({
    type: "email", name: "email", id: "email", autocomplete: "email", label: "Email", placeholder: ""
  }), "email");
  assert.equal(fill.classifyField({
    type: "tel", name: "phone", id: "phone", autocomplete: "tel", label: "Phone", placeholder: ""
  }), "phone");
  assert.equal(fill.classifyField({
    type: "text", name: "company", id: "company", autocomplete: "organization", label: "Company name", placeholder: ""
  }), "businessName");
  assert.equal(fill.classifyField({
    type: "tel", name: "work_phone", id: "work-phone", autocomplete: "tel", label: "Business phone", placeholder: ""
  }), "businessPhone");
  assert.equal(fill.classifyField({
    type: "password", name: "password", id: "password", autocomplete: "current-password", label: "Password", placeholder: ""
  }), "");
  assert.equal(fill.classifyField({
    type: "text", name: "username", id: "username", autocomplete: "username", label: "Username", placeholder: ""
  }), "");
  assert.equal(fill.classifyField({
    type: "search", name: "q", id: "q", autocomplete: "off", label: "Search", placeholder: ""
  }), "");
  assert.equal(fill.classifyField({
    type: "email", name: "work_email", id: "work-email", autocomplete: "email", label: "Work email", placeholder: ""
  }), "email");
  assert.equal(fill.classifyField({
    type: "text", name: "address", id: "address", autocomplete: "street-address", label: "Street address", placeholder: ""
  }), "address");
  assert.equal(fill.classifyField({
    type: "text", name: "business_address", id: "business-address", autocomplete: "", label: "Business address", placeholder: ""
  }), "businessAddress");
  assert.equal(fill.classifyField({
    type: "hidden", name: "email", id: "hidden-email", autocomplete: "email", label: "Email", placeholder: ""
  }), "");
  assert.equal(fill.classifyField({
    type: "text", name: "cc-number", id: "cc", autocomplete: "cc-number", label: "Card number", placeholder: ""
  }), "");
});

test("Fill my info lists the email field and writes it only after the click", () => {
  const document = mount("https://example.com/apply", "Apply", "Apply");
  const form = document.createElement("form");
  document.body.appendChild(form);
  let submitted = 0;
  form.addEventListener("submit", () => { submitted += 1; });
  const email = addField(document, "email", "email", "email", "Email");
  const company = addField(document, "company", "text", "company", "Company name");
  email.value = "before@example.com";
  company.value = "Kept LLC";
  let inputs = 0;
  let changes = 0;
  email.addEventListener("input", () => { inputs += 1; });
  email.addEventListener("change", () => { changes += 1; });
  const state = stateWith({ fillInfo: true, fillBusiness: false }, {
    profile: { name: "Ada Lovelace", email: "user@example.com", phone: "555-0100", address: "1 Main St" },
    business: { name: "Northwind LLC", phone: "555-0199", address: "2 Main St" }
  });
  globalThis.JEVFill.sync(state);
  const card = document.getElementById("jev-fill-info");
  assert.ok(card);
  assert.match(card.textContent, /Fill my info/);
  const row = rowByLabel(card, "Email");
  assert.ok(row);
  assert.match(row.textContent, /user@example.com/);
  assert.equal(email.value, "before@example.com");
  assert.equal(inputs, 0);
  assert.equal(document.getElementById("jev-fill-business"), null);
  row.querySelector("button").click();
  assert.equal(email.value, "user@example.com");
  assert.equal(inputs, 1);
  assert.equal(changes, 1);
  assert.equal(submitted, 0);
  assert.equal(company.value, "Kept LLC");
});

test("fillInfo off does not show the card and does not write", () => {
  const document = mount("https://example.com/apply", "Apply", "Apply");
  const email = addField(document, "email", "email", "email", "Email");
  email.value = "before@example.com";
  globalThis.JEVFill.sync(stateWith({ fillInfo: false, fillBusiness: false }, {
    profile: { name: "Ada Lovelace", email: "user@example.com", phone: "", address: "" }
  }));
  assert.equal(document.getElementById("jev-fill-info"), null);
  assert.equal(email.value, "before@example.com");
});

test("fillBusiness off does not write the company name even if fillInfo is on", () => {
  const document = mount("https://example.com/apply", "Apply", "Apply");
  const email = addField(document, "email", "email", "email", "Email");
  const company = addField(document, "company", "text", "company", "Company name");
  const workPhone = addField(document, "work-phone", "tel", "business_phone", "Business phone");
  email.value = "before@example.com";
  company.value = "Kept LLC";
  workPhone.value = "555-0000";
  const state = stateWith({ fillInfo: true, fillBusiness: false }, {
    profile: { name: "Ada Lovelace", email: "user@example.com", phone: "555-0100", address: "1 Main St" },
    business: { name: "Northwind LLC", phone: "555-0199", address: "2 Main St" }
  });
  globalThis.JEVFill.sync(state);
  const card = document.getElementById("jev-fill-info");
  assert.equal(document.getElementById("jev-fill-business"), null);
  for (const button of card.querySelectorAll("button")) button.click();
  assert.equal(email.value, "user@example.com");
  assert.equal(company.value, "Kept LLC");
  assert.equal(workPhone.value, "555-0000");
  state.features.fillBusiness = true;
  globalThis.JEVFill.sync(state);
  const business = document.getElementById("jev-fill-business");
  assert.match(business.textContent, /Fill my business/);
  assert.equal(company.value, "Kept LLC");
  rowByLabel(business, "Company name").querySelector("button").click();
  assert.equal(company.value, "Northwind LLC");
  assert.equal(email.value, "user@example.com");
});

test("empty profile click does not replace an existing field value", () => {
  const document = mount("https://example.com/apply", "Apply", "Apply");
  const email = addField(document, "email", "email", "email", "Email");
  email.value = "existing@example.com";
  const state = stateWith({ fillInfo: true, fillBusiness: false }, {
    profile: { name: "", email: "", phone: "", address: "" }
  });
  globalThis.JEVFill.sync(state);
  const row = rowByLabel(document.getElementById("jev-fill-info"), "Email");
  assert.match(row.textContent, /Add this in Setup/);
  row.querySelector("button").click();
  assert.equal(email.value, "existing@example.com");
});
