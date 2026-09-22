"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const { FEATURES, SITES } = require(path.join(root, "lib", "contract.js"));

function read(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

test("manifest is one extension named Jev extension stack", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "Jev extension stack");
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.equal(manifest.action.default_title, "Jev extension stack");
  assert.equal(manifest.options_ui.page, "settings.html");
  assert.equal(manifest.options_ui.open_in_tab, true);
  assert.ok(manifest.permissions.includes("storage"));
  assert.ok(manifest.permissions.includes("tabs"));
  assert.equal(manifest.commands["toggle-highlight"].description.length > 0, true);
  const scripts = manifest.content_scripts[0].js.join("\n");
  for (const file of [
    "lib/contract.js",
    "lib/runtime.js",
    "lib/match.js",
    "lib/url.js",
    "social/content.js",
    "mail/content.js",
    "page/content.js",
    "docs/content.js"
  ]) {
    assert.ok(scripts.includes(file), file);
  }
  assert.deepEqual(manifest.action.default_icon["16"], "icons/icon16.png");
  assert.equal(fs.existsSync(path.join(root, "categories.js")), false);
  assert.equal(fs.existsSync(path.join(root, "options.html")), false);
  assert.equal(fs.existsSync(path.join(root, "content.js")), false);
});

test("logo file is the real Umby mark", () => {
  const buf = fs.readFileSync(path.join(root, "icons", "umby-logo.png"));
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(buf.readUInt32BE(16), 160);
  assert.equal(buf.readUInt32BE(20), 66);
  assert.notEqual(buf.length, 17974);
  for (const name of ["icon16.png", "icon32.png", "icon48.png", "icon128.png"]) {
    const icon = fs.readFileSync(path.join(root, "icons", name));
    assert.equal(icon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  }
});

test("settings page has every feature switch, every site switch, and the logo", () => {
  const html = read("settings.html");
  assert.match(html, /src="icons\/umby-logo.png"/);
  assert.match(html, /alt="Umby"/);
  assert.doesNotMatch(html, /Marketing/i);
  assert.match(html, /Saved only on this computer/i);
  for (const id of Object.values(FEATURES)) {
    assert.ok(html.includes(`data-feature="${id}"`), id);
  }
  for (const id of Object.values(SITES)) {
    assert.ok(html.includes(`data-site="${id}"`), id);
  }
  for (const id of [
    "interest-input", "interest-add", "not-interest-input", "not-interest-add",
    "gold-account-input", "red-account-input", "reading-search",
    "session-gold", "session-red", "hours-start", "hours-end",
    "profile-name", "profile-email", "profile-phone", "profile-address",
    "business-name", "business-phone", "business-address",
    "must-haves", "job-can-do"
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
});

test("popup is only the master switch, sites, and Setup", () => {
  const html = read("popup.html");
  const script = read("popup.js");
  assert.match(html, /src="icons\/umby-logo.png"/);
  assert.match(html, /alt="Umby"/);
  assert.ok(html.includes('id="turn"'));
  assert.ok(html.includes('id="setup"'));
  assert.doesNotMatch(html, /data-feature=/);
  assert.doesNotMatch(html + script, /categories\.js/);
  assert.doesNotMatch(html, /Marketing/i);
  for (const id of Object.values(SITES)) {
    assert.ok(html.includes(`data-site="${id}"`), id);
  }
});

test("copy does not ask for an API key or ship a fixed interest catalog", () => {
  const extensionReadme = read("README.md");
  const rootReadme = fs.readFileSync(path.join(root, "..", "..", "README.md"), "utf8");
  assert.doesNotMatch(extensionReadme, /API key/i);
  assert.match(extensionReadme, /Jev extension stack/);
  assert.match(rootReadme, /Jev extension stack/);
  assert.doesNotMatch(rootReadme, /Jev key is entered/);
  const banned = ["plumbing", "water heater", "JEV_CATEGORIES", "JEV_SPAM"];
  for (const file of ["popup.js", "settings.js", "background.js"]) {
    const text = read(file);
    for (const word of banned) assert.equal(text.includes(word), false, file + " " + word);
  }
});
