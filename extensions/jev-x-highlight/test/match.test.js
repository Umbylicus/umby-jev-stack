"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const match = require("../lib/match.js");

const SPAM = [
  "giveaway",
  "airdrop",
  "follow back",
  "f4f",
  "dm to win",
  "crypto signal",
  "guaranteed profit",
  "link in bio",
  "onlyfans",
  "double your money"
];

test("interest phrase is gold, a non-interest is bad, and neither is none", () => {
  const state = { interests: ["fencing"], notInterests: ["soccer"] };
  assert.equal(match.classify({ text: "fencing season starts" }, state), "gold");
  assert.equal(match.classify({ text: "soccer highlights" }, state), "bad");
  assert.equal(match.classify({ text: "weather today" }, state), "none");
  assert.equal(match.classify({ text: "fencing and soccer" }, state), "bad");
});

test("an ad is bad even when the interest and a gold account also match", () => {
  const state = {
    interests: ["fencing"],
    features: { goldAccounts: true },
    goldAccounts: ["ada"]
  };
  assert.equal(match.classify({ text: "fencing", author: "@ada", ad: true }, state), "bad");
});

test("phrase boundaries keep car out of carpet and allow flexible whitespace", () => {
  assert.equal(match.phraseHit("the carpet cleaned", ["car"]), false);
  assert.equal(match.phraseHit("Carpet", ["car"]), false);
  assert.equal(match.phraseHit("the car cleaned", ["car"]), true);
  assert.equal(match.phraseHit("Need a Water heater soon", ["water heater"]), true);
  assert.equal(match.phraseHit("water\nheater", ["Water   heater"]), true);
  assert.equal(match.phraseHit("carpet", ["", "  "]), false);
  assert.equal(match.phraseHit("carpet", null), false);
});

test("red accounts beat an interest, gold accounts mark gold, and off flags ignore both lists", () => {
  const author = "Ada Lovelace\n@ada";
  assert.equal(match.classify({
    text: "fencing season",
    author
  }, {
    interests: ["fencing"],
    features: { redAccounts: true, goldAccounts: true },
    redAccounts: ["@ada"],
    goldAccounts: ["ada"]
  }), "bad");
  assert.equal(match.classify({
    text: "weather today",
    author: "@Ada"
  }, {
    features: { goldAccounts: true },
    goldAccounts: ["ada"]
  }), "gold");
  assert.equal(match.accountHit("@adam", ["ada"]), false);
  assert.equal(match.classify({
    text: "weather today",
    author: "@ada"
  }, {
    features: { redAccounts: false, goldAccounts: false },
    redAccounts: ["ada"],
    goldAccounts: ["ada"]
  }), "none");
  assert.equal(match.classify({
    text: "fencing",
    author: "@ada"
  }, {
    interests: ["fencing"],
    redAccounts: ["ada"],
    goldAccounts: ["ada"]
  }), "gold");
});

test("obvious spam is bad and the word promoted is not spam unless the post is an ad", () => {
  for (const phrase of SPAM) {
    assert.equal(match.looksLikeSpam("see this " + phrase + " now"), true, phrase);
    assert.equal(match.classify({ text: "see this " + phrase + " now", author: "@ada" }, {
      interests: ["this"],
      features: { goldAccounts: true },
      goldAccounts: ["ada"]
    }), "bad", phrase);
  }
  assert.equal(match.looksLikeSpam("sponsored"), false);
  assert.equal(match.looksLikeSpam("I got promoted today"), false);
  assert.equal(match.classify({ text: "I got promoted today" }, { interests: [] }), "none");
  assert.equal(match.classify({ text: "I got promoted today", ad: true }, {}), "bad");
  assert.equal(match.classify({ text: "giveaway" }, null), "bad");
  assert.equal(match.classify({ text: "hello" }, {}), "none");
});
