"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

require(path.join(__dirname, "..", "lib", "contract.js"));
const runtime = require(path.join(__dirname, "..", "lib", "runtime.js"));

test("defaults keep noisy tools off and X highlighting ready", () => {
  const state = runtime.mergeState(null);
  assert.equal(state.enabled, false);
  assert.equal(state.sites.x, true);
  assert.equal(state.sites.facebook, false);
  assert.equal(state.sites.gmail, false);
  assert.equal(state.features.highlight, true);
  assert.equal(state.features.ads, false);
  assert.equal(state.features.focusDeclutter, false);
  assert.equal(state.features.mail, false);
  assert.equal(state.features.highlightShortcut, true);
  assert.deepEqual(state.interests, []);
  assert.deepEqual(state.notInterests, []);
  assert.equal(state.profile.email, "");
  assert.equal(state.business.name, "");
});

test("master off stops every feature and a site off stays off", () => {
  const state = runtime.mergeState({
    enabled: false,
    sites: { x: true, facebook: true },
    features: { ads: true, mail: true, highlight: true }
  });
  assert.equal(runtime.featureOn(state, "ads"), false);
  assert.equal(runtime.siteOn(state, "x"), false);
  state.enabled = true;
  state.sites.facebook = false;
  assert.equal(runtime.siteOn(state, "facebook"), false);
  assert.equal(runtime.featureOn(state, "ads"), true);
  assert.equal(runtime.featureOn(state, "mail"), true);
  assert.equal(runtime.featureOn(state, "draftCheck"), false);
});

test("site hostnames map to the eight switches", () => {
  assert.equal(runtime.siteId("x.com"), "x");
  assert.equal(runtime.siteId("mobile.twitter.com"), "x");
  assert.equal(runtime.siteId("www.facebook.com"), "facebook");
  assert.equal(runtime.siteId("www.instagram.com"), "instagram");
  assert.equal(runtime.siteId("www.youtube.com"), "youtube");
  assert.equal(runtime.siteId("youtu.be"), "youtube");
  assert.equal(runtime.siteId("old.reddit.com"), "reddit");
  assert.equal(runtime.siteId("www.linkedin.com"), "linkedin");
  assert.equal(runtime.siteId("mail.google.com"), "gmail");
  assert.equal(runtime.siteId("outlook.office.com"), "outlook");
  assert.equal(runtime.siteId("outlook.live.com"), "outlook");
  assert.equal(runtime.siteId("outlook.office365.com"), "outlook");
  assert.equal(runtime.siteId("outlook.cloud.microsoft"), "outlook");
  assert.equal(runtime.siteId("example.com"), "");
});

test("work hours do nothing until that feature is on", () => {
  const state = runtime.mergeState({
    enabled: true,
    features: { highlight: true, workHours: false },
    workHours: { days: [1], start: "09:00", end: "17:00" }
  });
  const sunday = new Date(2026, 8, 20, 12, 0, 0);
  assert.equal(sunday.getDay(), 0);
  assert.equal(runtime.inWorkHours(state, sunday), true);
  assert.equal(runtime.marksActive(state, sunday), true);
  state.features.workHours = true;
  assert.equal(runtime.inWorkHours(state, sunday), false);
  assert.equal(runtime.marksActive(state, sunday), false);
  const monday = new Date(2026, 8, 21, 9, 0, 0);
  assert.equal(monday.getDay(), 1);
  assert.equal(runtime.inWorkHours(state, monday), true);
  assert.equal(runtime.inWorkHours(state, new Date(2026, 8, 21, 17, 0, 0)), false);
  assert.equal(runtime.inWorkHours(state, new Date(2026, 8, 21, 8, 59, 0)), false);
});

test("turning highlight off stops marks even inside work hours", () => {
  const state = runtime.mergeState({
    enabled: true,
    features: { highlight: false, workHours: false }
  });
  assert.equal(runtime.marksActive(state, new Date(2026, 8, 21, 12, 0, 0)), false);
});

test("phrase lists drop blanks and duplicates", () => {
  const state = runtime.mergeState({ interests: [" HVAC ", "hvac", "", "fences"] });
  assert.deepEqual(state.interests, ["HVAC", "fences"]);
});
