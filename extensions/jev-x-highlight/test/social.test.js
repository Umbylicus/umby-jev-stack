"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../lib/contract.js");
require("../lib/runtime.js");
require("../lib/match.js");
const social = require("../social/content.js");
const { createDocument, h } = require("./minidom");

function baseState(overrides) {
  const state = {
    enabled: true,
    sites: {
      x: true,
      facebook: true,
      instagram: true,
      youtube: true,
      reddit: true,
      linkedin: true
    },
    features: {
      highlight: true,
      ads: false,
      focusDeclutter: false,
      goldAccounts: false,
      redAccounts: false,
      sessionCount: false,
      readingList: false,
      workHours: false
    },
    interests: [],
    notInterests: [],
    goldAccounts: [],
    redAccounts: [],
    workHours: { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }
  };
  const extra = overrides || {};
  if (extra.features) state.features = Object.assign({}, state.features, extra.features);
  if (extra.sites) state.sites = Object.assign({}, state.sites, extra.sites);
  for (const key of ["enabled", "interests", "notInterests", "goldAccounts", "redAccounts", "workHours"]) {
    if (Object.prototype.hasOwnProperty.call(extra, key)) state[key] = extra[key];
  }
  return state;
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

test("apply on an X fixture outlines gold, badges bad, and leaves the rest unmarked", () => {
  const { doc, el } = dom();
  const gold = tweet(el, "101", "Ada", "fencing season");
  const bad = tweet(el, "202", "Bea", "soccer highlights");
  const plain = tweet(el, "303", "Cam", "weather today");
  doc.body.append(gold, bad, plain);
  social.apply(doc, baseState({ interests: ["fencing"], notInterests: ["soccer"] }), new Date(), "x.com");
  assert.equal(gold.classList.contains("jev-gold"), true);
  assert.equal(gold.querySelector(".jev-x"), null);
  const badge = bad.querySelector(".jev-x");
  assert.equal(badge.textContent, "X");
  assert.equal(badge.getAttribute("aria-hidden"), "true");
  assert.equal(bad.classList.contains("jev-bad"), true);
  assert.equal(plain.classList.contains("jev-gold"), false);
  assert.equal(plain.classList.contains("jev-bad"), false);
  assert.equal(plain.querySelector(".jev-x"), null);
  assert.equal(plain.classList.contains("jev-faded"), false);
});

test("ads on removes an ad iframe and does not remove a composer; ads off removes nothing", () => {
  const { doc, el } = dom();
  const composer = el("div", {
    role: "textbox",
    "data-testid": "tweetTextarea_0",
    "aria-label": "What's happening?",
    text: "What's happening?"
  });
  const frame = el("iframe", { src: "https://ad.doubleclick.net/gampad/ads" });
  const player = el("div", { id: "movie_player" });
  doc.body.append(composer, frame, player);
  assert.equal(social.isProtected(composer), true);
  assert.equal(social.isProtected(player), false);
  social.apply(doc, baseState({ features: { ads: false } }), new Date(), "x.com");
  assert.equal(frame.parentNode, doc.body);
  assert.equal(composer.parentNode, doc.body);
  assert.equal(frame.classList.contains("jev-blur"), false);
  const ads = social.findAds(doc, "x");
  assert.equal(ads.some((ad) => ad.el === frame && ad.action === "remove"), true);
  assert.equal(ads.some((ad) => ad.el === composer || ad.el === player), false);
  social.apply(doc, baseState({ features: { ads: true } }), new Date(), "x.com");
  assert.equal(frame.parentNode, null);
  assert.equal(composer.parentNode, doc.body);
  assert.equal(player.parentNode, doc.body);
});

test("a sponsored unit that wraps a real post is blurred instead of removed", () => {
  const { doc, el } = dom();
  const article = el("div", { role: "article" },
    el("h3", {}, el("a", { href: "/ada" }, "Ada")),
    el("div", { text: "Hello friends" })
  );
  const unit = el("div", { id: "unit" },
    el("span", { text: "Sponsored" }),
    article
  );
  doc.body.append(unit);
  social.apply(doc, baseState({ features: { ads: true } }), new Date(), "www.facebook.com");
  assert.equal(unit.classList.contains("jev-blur"), true);
  assert.equal(article.parentNode, unit);
  assert.equal(article.classList.contains("jev-blur"), false);
  assert.equal(doc.querySelector("span").parentNode, unit);
});

test("a facebook feed child with Sponsored outside the article is an ad", () => {
  const { doc, el } = dom();
  const article = el("div", { role: "article" },
    el("h3", {}, el("a", { href: "/ada" }, "Ada")),
    el("div", { text: "Hello friends" })
  );
  const marker = el("div", { "aria-label": "Sponsored" });
  const unit = el("div", { id: "unit" }, marker, article);
  const feed = el("div", { role: "feed" }, unit);
  const pagelet = el("div", { "data-pagelet": "FeedUnit_9" },
    el("span", { title: "Sponsored" }),
    el("div", { text: "Standalone pagelet copy" })
  );
  doc.body.append(feed, pagelet);
  const posts = social.findPosts(doc, "facebook");
  assert.equal(posts.some((post) => post.el === unit && post.ad === true), true);
  assert.equal(posts.some((post) => post.el === article && post.ad === true), false);
  assert.equal(posts.some((post) => post.el === pagelet && post.ad === true), true);
  const ads = social.findAds(doc, "facebook");
  assert.equal(ads.some((ad) => ad.el === unit), true);
  assert.equal(ads.some((ad) => ad.el === feed), false);
  assert.equal(ads.some((ad) => ad.el === pagelet && ad.action === "remove"), true);
  social.apply(doc, baseState({ features: { ads: true } }), new Date(), "www.facebook.com");
  assert.equal(unit.parentNode, feed);
  assert.equal(article.parentNode, unit);
  assert.equal(unit.classList.contains("jev-blur"), true);
  assert.equal(article.classList.contains("jev-blur"), false);
  assert.equal(pagelet.parentNode, null);
  assert.equal(feed.parentNode, doc.body);
});

test("facebook letter-span textContent Sponsored is an ad", () => {
  const { doc, el } = dom();
  const letters = ["S", "p", "o", "n", "s", "o", "r", "e", "d"].map((letter) => el("span", { text: letter }));
  const label = el("div", { id: "label" }, ...letters);
  assert.equal(label.textContent, "Sponsored");
  const article = el("div", { role: "article" },
    el("h3", {}, el("a", { href: "/shop" }, "Shop")),
    label,
    el("div", { text: "Limited offer" })
  );
  const hidden = el("div", { role: "article", id: "zw" },
    el("h3", {}, el("a", { href: "/zw" }, "Zed")),
    el("span", { text: "S\u200bpon\u200csored" }),
    el("div", { text: "Zero width label" })
  );
  const talk = el("div", { role: "article", id: "talk" },
    el("h3", {}, el("a", { href: "/sam" }, "Sam")),
    el("div", { text: "I wrote a normal post about sponsored products and how the word shows up in conversation without this being an advertisement." })
  );
  doc.body.append(article, hidden, talk);
  const posts = social.findPosts(doc, "facebook");
  assert.equal(posts.some((post) => post.el === article && post.ad === true), true);
  assert.equal(posts.some((post) => post.el === hidden && post.ad === true), true);
  assert.equal(posts.some((post) => post.el === talk && post.ad === true), false);
  const decoy = el("div", { id: "decoy" },
    el("span", { text: "S" }),
    el("span", { "aria-hidden": "true", text: "xx" }),
    el("span", { text: "ponsored" })
  );
  Object.defineProperty(decoy, "innerText", { configurable: true, get() { return "Sponsored"; } });
  assert.equal(decoy.textContent, "Sxxponsored");
  const padded = el("div", { role: "article", id: "padded" },
    el("h3", {}, el("a", { href: "/pad" }, "Pat")),
    decoy,
    el("div", { text: "Shop now" })
  );
  doc.body.append(padded);
  assert.equal(social.findPosts(doc, "facebook").some((post) => post.el === padded && post.ad === true), true);
  social.apply(doc, baseState({ features: { ads: true } }), new Date(), "www.facebook.com");
  assert.equal(article.parentNode, null);
  assert.equal(hidden.parentNode, null);
  assert.equal(padded.parentNode, null);
  assert.equal(talk.parentNode, doc.body);
});

test("an ad article that contains a menu is removed when ads are on", () => {
  const { doc, el } = dom();
  const menu = el("div", { role: "menu" },
    el("div", { role: "menuitem", text: "Hide ad" })
  );
  const article = el("div", { role: "article" },
    el("span", { text: "Sponsored" }),
    menu,
    el("div", { text: "Buy the thing" })
  );
  const composer = el("div", {
    role: "textbox",
    "aria-label": "What's on your mind?",
    text: "What's on your mind?"
  });
  const nav = el("nav", { id: "topnav" }, el("a", { href: "/home", text: "Home" }));
  const drawer = el("div", { id: "drawer", "data-testid": "DMDrawer", "aria-label": "Messages" });
  const shellComposer = el("div", { role: "textbox", "aria-label": "Create a post", text: "Create a post" });
  const shell = el("div", { id: "shell" },
    el("span", { text: "Sponsored" }),
    shellComposer
  );
  doc.body.append(nav, composer, drawer, shell, article);
  assert.equal(social.isProtected(article), false);
  assert.equal(social.isProtected(menu), true);
  assert.equal(social.isProtected(composer), true);
  assert.equal(social.isProtected(nav), true);
  assert.equal(social.isProtected(drawer), true);
  social.apply(doc, baseState({ features: { ads: true } }), new Date(), "www.facebook.com");
  assert.equal(article.parentNode, null);
  assert.equal(composer.parentNode, doc.body);
  assert.equal(nav.parentNode, doc.body);
  assert.equal(drawer.parentNode, doc.body);
  assert.equal(shellComposer.parentNode, shell);
  assert.equal(shell.parentNode, doc.body);
  assert.equal(shell.classList.contains("jev-blur"), true);
  assert.equal(nav.classList.contains("jev-blur"), false);
  assert.equal(composer.classList.contains("jev-blur"), false);
});

test("focus blurs everything except an interest and does not delete it", () => {
  const { doc, el } = dom();
  const gold = tweet(el, "101", "Ada", "fencing season");
  const bad = tweet(el, "202", "Bea", "soccer highlights");
  const plain = tweet(el, "303", "Cam", "weather today");
  doc.body.append(gold, bad, plain);
  social.apply(doc, baseState({
    interests: ["fencing"],
    notInterests: ["soccer"],
    features: { focusDeclutter: true, highlight: true }
  }), new Date(), "x.com");
  assert.equal(gold.classList.contains("jev-blur"), false);
  assert.equal(gold.classList.contains("jev-gold"), true);
  assert.equal(bad.classList.contains("jev-blur"), true);
  assert.equal(plain.classList.contains("jev-blur"), true);
  assert.equal(bad.parentNode, doc.body);
  assert.equal(plain.parentNode, doc.body);
  social.apply(doc, baseState({
    interests: ["fencing"],
    notInterests: ["soccer"],
    features: { focusDeclutter: false, highlight: true }
  }), new Date(), "x.com");
  assert.equal(bad.classList.contains("jev-blur"), false);
  assert.equal(plain.classList.contains("jev-blur"), false);
  assert.equal(gold.parentNode, doc.body);
});

test("site switch off clears marks and leaves the page otherwise in place", () => {
  const { doc, el } = dom();
  const gold = tweet(el, "101", "Ada", "fencing season");
  const bad = tweet(el, "202", "Bea", "soccer highlights");
  doc.body.append(gold, bad);
  social.apply(doc, baseState({ interests: ["fencing"], notInterests: ["soccer"] }), new Date(), "x.com");
  assert.equal(gold.classList.contains("jev-gold"), true);
  social.apply(doc, baseState({
    interests: ["fencing"],
    notInterests: ["soccer"],
    sites: { x: false }
  }), new Date(), "x.com");
  assert.equal(gold.classList.contains("jev-gold"), false);
  assert.equal(bad.classList.contains("jev-bad"), false);
  assert.equal(doc.querySelector(".jev-x"), null);
  assert.equal(gold.parentNode, doc.body);
  social.apply(doc, baseState({
    enabled: false,
    interests: ["fencing"],
    notInterests: ["soccer"]
  }), new Date(), "x.com");
  assert.equal(gold.classList.contains("jev-gold"), false);
  social.apply(doc, baseState({ interests: ["fencing"] }), new Date(), "example.com");
  assert.equal(gold.classList.contains("jev-gold"), false);
});

test("declutter hides Who to follow and does not hide the composer or the feed", () => {
  const { doc, el } = dom();
  const composer = el("div", {
    role: "textbox",
    "data-testid": "tweetTextarea_0",
    text: "What's happening?"
  });
  const feed = el("div", { role: "main" },
    tweet(el, "101", "Ada", "hello feed")
  );
  const follow = el("div", { id: "follow" },
    el("h2", { text: "Who to follow" }),
    el("div", { text: "@pat" })
  );
  const keep = el("div", { id: "keep", text: "Search the site" });
  const column = el("div", { "data-testid": "sidebarColumn" }, follow, keep);
  doc.body.append(feed, composer, column);
  social.apply(doc, baseState({ features: { focusDeclutter: true, highlight: false } }), new Date(), "x.com");
  assert.equal(follow.classList.contains("jev-hide"), true);
  assert.equal(column.classList.contains("jev-hide"), false);
  assert.equal(keep.classList.contains("jev-hide"), false);
  assert.equal(composer.classList.contains("jev-hide"), false);
  assert.equal(feed.classList.contains("jev-hide"), false);
  assert.equal(composer.parentNode, doc.body);
  assert.equal(social.isProtected(composer), true);
  social.apply(doc, baseState({ features: { focusDeclutter: false, highlight: false } }), new Date(), "x.com");
  assert.equal(follow.classList.contains("jev-hide"), false);

  const mixed = el("div", { id: "mixed" },
    el("h2", { text: "Who to follow" }),
    tweet(el, "303", "Ada", "a real post"),
    el("p", { id: "about", text: "About" })
  );
  doc.body.append(mixed);
  social.apply(doc, baseState({ features: { focusDeclutter: true, highlight: false } }), new Date(), "x.com");
  assert.equal(mixed.classList.contains("jev-hide"), false);
  assert.equal(mixed.querySelector("article").classList.contains("jev-hide"), false);
  assert.equal(doc.getElementById("about").classList.contains("jev-hide"), false);
});

test("gold and red account flags use the post author", () => {
  const { doc, el } = dom();
  const gold = tweet(el, "1", "Ada\n@ada", "weather today");
  const red = tweet(el, "2", "Bea\n@bea", "fencing season");
  doc.body.append(gold, red);
  social.apply(doc, baseState({
    interests: ["fencing"],
    features: { goldAccounts: true, redAccounts: true },
    goldAccounts: ["ada"],
    redAccounts: ["@bea"]
  }), new Date(), "x.com");
  assert.equal(gold.classList.contains("jev-gold"), true);
  assert.equal(red.classList.contains("jev-bad"), true);
  assert.ok(red.querySelector(".jev-x"));
  assert.equal(gold.querySelector(".jev-x"), null);
});

test("YouTube uses the title, not a description that merely contains the interest", () => {
  const { doc, el } = dom();
  const decoy = el("ytd-video-renderer", {},
    el("a", { id: "video-title", href: "/watch?v=paintfence01", text: "Paint a fence" }),
    el("div", { id: "description", text: "water heater repair guide" })
  );
  const hit = el("ytd-rich-item-renderer", {},
    el("a", { id: "video-title", href: "/watch?v=heaterinstall", text: "Water heater install" })
  );
  const grid = el("ytd-grid-video-renderer", {},
    el("a", { id: "video-title", href: "/watch?v=dailyvlog0001", text: "Daily vlog" })
  );
  const shelf = el("ytd-reel-shelf-renderer", {},
    el("h2", { text: "Shorts" }),
    el("div", { text: "water heater shorts" })
  );
  const beside = el("div", { id: "browse" }, shelf, hit);
  const shorts = el("ytd-rich-shelf-renderer", {},
    el("h2", { text: "Shorts" })
  );
  const news = el("ytd-rich-shelf-renderer", {},
    el("h2", { text: "Breaking news" })
  );
  doc.body.append(decoy, beside, grid, shorts, news);
  const posts = social.findPosts(doc, "youtube");
  assert.deepEqual(posts.map((post) => post.text.trim()).sort(), ["Daily vlog", "Paint a fence", "Water heater install"]);
  assert.equal(posts.some((post) => post.el === shelf), false);
  social.apply(doc, baseState({
    interests: ["water heater"],
    features: { highlight: true, focusDeclutter: true }
  }), new Date(), "www.youtube.com");
  assert.equal(decoy.classList.contains("jev-gold"), false);
  assert.equal(hit.classList.contains("jev-gold"), true);
  assert.equal(grid.classList.contains("jev-gold"), false);
  assert.equal(shelf.classList.contains("jev-gold"), false);
  assert.equal(shelf.classList.contains("jev-hide"), true);
  assert.equal(beside.classList.contains("jev-hide"), false);
  assert.equal(shorts.classList.contains("jev-hide"), true);
  assert.equal(news.classList.contains("jev-hide"), false);
});

test("other social posts expose text, author, and the platform ad label", () => {
  const { doc, el } = dom();
  const composer = el("div", { role: "article" },
    el("div", { role: "textbox", "aria-label": "What's on your mind?", text: "What's on your mind?" })
  );
  const facebook = el("div", { role: "article" },
    el("h3", {}, el("a", { href: "/ada" }, "Ada Lovelace")),
    el("div", { text: "Loved the water heater talk" }),
    el("span", { text: "Sponsored" })
  );
  doc.body.append(composer, facebook);
  const facebookPosts = social.findPosts(doc, "facebook");
  assert.equal(facebookPosts.length, 1);
  assert.equal(facebookPosts[0].el, facebook);
  assert.equal(facebookPosts[0].author, "Ada Lovelace");
  assert.equal(facebookPosts[0].ad, true);
  const labeled = el("div", { role: "article" },
    el("span", { "aria-label": "Sponsored" }),
    el("div", { text: "Shop the sale" })
  );
  doc.body.append(labeled);
  const labeledPosts = social.findPosts(doc, "facebook");
  assert.equal(labeledPosts.some((post) => post.el === labeled && post.ad), true);
  assert.match(facebookPosts[0].text, /water heater/);

  const instagramDoc = createDocument();
  const ig = (tag, props, ...children) => h(tag, Object.assign({ ownerDocument: instagramDoc }, props || {}), ...children);
  const article = ig("article", {},
    ig("header", {}, ig("a", { href: "/ada" }, "ada")),
    ig("div", { text: "caption about fences" })
  );
  instagramDoc.body.append(article);
  const instagramPosts = social.findPosts(instagramDoc, "instagram");
  assert.equal(instagramPosts.length, 1);
  assert.equal(instagramPosts[0].author, "ada");
  assert.equal(instagramPosts[0].ad, false);
  assert.match(instagramPosts[0].text, /fences/);
  assert.doesNotMatch(instagramPosts[0].text, /ada/);

  const redditDoc = createDocument();
  const rd = (tag, props, ...children) => h(tag, Object.assign({ ownerDocument: redditDoc }, props || {}), ...children);
  const promoted = rd("shreddit-post", { "is-ad": "" },
    rd("a", { href: "/user/promo", text: "promo" }),
    rd("h2", { slot: "title", text: "Buy now" })
  );
  const note = rd("div", { "data-testid": "post-container" },
    rd("span", { slot: "authorName", text: "sam" }),
    rd("h2", { text: "City council notes" })
  );
  const shredditAd = rd("shreddit-ad", {}, rd("span", { text: "Promoted" }));
  redditDoc.body.append(promoted, note, shredditAd);
  const redditPosts = social.findPosts(redditDoc, "reddit");
  assert.equal(redditPosts.length, 2);
  assert.equal(redditPosts[0].ad, true);
  assert.equal(redditPosts[0].author, "promo");
  assert.match(redditPosts[0].text, /Buy now/);
  assert.equal(redditPosts[1].ad, false);
  assert.equal(redditPosts[1].author, "sam");
  const redditAds = social.findAds(redditDoc, "reddit");
  assert.equal(redditAds.some((ad) => ad.el === promoted && ad.action === "remove"), true);
  assert.equal(redditAds.some((ad) => ad.el === shredditAd && ad.action === "remove"), true);
  assert.equal(redditAds.some((ad) => ad.el === note), false);

  const linkedDoc = createDocument();
  const li = (tag, props, ...children) => h(tag, Object.assign({ ownerDocument: linkedDoc }, props || {}), ...children);
  const update = li("div", { class: "feed-shared-update-v2", "data-id": "urn:li:activity:99" },
    li("span", { class: "update-components-actor__name", text: "Grace" }),
    li("span", { text: "Promoted" }),
    li("div", { class: "update-components-text", text: "Hiring writers" })
  );
  linkedDoc.body.append(update);
  const linkedPosts = social.findPosts(linkedDoc, "linkedin");
  assert.equal(linkedPosts.length, 1);
  assert.equal(linkedPosts[0].author, "Grace");
  assert.equal(linkedPosts[0].ad, true);
  assert.equal(linkedPosts[0].id, "urn:li:activity:99");
  assert.match(linkedPosts[0].text, /Hiring writers/);
});

test("session counts fire once per id only while marks are active, and Save does not navigate", () => {
  const messages = [];
  globalThis.chrome = {
    runtime: {
      sendMessage(message) { messages.push(message); }
    }
  };
  const { doc, el } = dom();
  const gold = tweet(el, "555", "Ada", "fencing season");
  const again = tweet(el, "555", "Ada", "fencing season");
  const bad = tweet(el, "202", "Bea", "soccer highlights");
  const plain = tweet(el, "303", "Cam", "weather today");
  doc.body.append(gold, again, bad, plain);
  social.apply(doc, baseState({
    interests: ["fencing"],
    notInterests: ["soccer"],
    features: { sessionCount: true, readingList: true, highlight: true }
  }), new Date(), "x.com");
  const counts = messages.filter((message) => message.type === "jev-count");
  assert.equal(counts.length, 2);
  assert.equal(counts.filter((message) => message.mark === "gold" && message.id === "555").length, 1);
  assert.equal(counts.filter((message) => message.mark === "bad" && message.id === "202").length, 1);
  const save = gold.querySelector(".jev-save");
  assert.equal(save.textContent, "Save");
  let prevented = false;
  save.dispatchEvent({
    type: "click",
    preventDefault() { prevented = true; },
    stopPropagation() {}
  });
  assert.equal(prevented, true);
  const saved = messages.find((message) => message.type === "jev-save");
  assert.equal(saved.item.id, "555");
  assert.equal(saved.item.site, "x");
  assert.match(saved.item.url, /\/status\/555/);
  assert.match(saved.item.text, /fencing/);
  messages.length = 0;
  social.apply(doc, baseState({
    interests: ["fencing"],
    notInterests: ["soccer"],
    features: { sessionCount: true, readingList: true, highlight: false }
  }), new Date(), "x.com");
  assert.equal(messages.filter((message) => message.type === "jev-count").length, 0);
  assert.equal(doc.querySelector(".jev-x"), null);
  assert.ok(doc.querySelector(".jev-save"));
});

test("outside work hours the clock blocks outlines and the red X", () => {
  const { doc, el } = dom();
  const gold = tweet(el, "101", "Ada", "fencing season");
  const bad = tweet(el, "202", "Bea", "soccer highlights");
  doc.body.append(gold, bad);
  const sunday = new Date(2026, 8, 20, 12, 0, 0);
  assert.equal(sunday.getDay(), 0);
  social.apply(doc, baseState({
    interests: ["fencing"],
    notInterests: ["soccer"],
    features: { highlight: true, workHours: false }
  }), sunday, "x.com");
  assert.equal(gold.classList.contains("jev-gold"), true);
  social.apply(doc, baseState({
    interests: ["fencing"],
    notInterests: ["soccer"],
    features: { highlight: true, workHours: true, focusDeclutter: false }
  }), sunday, "x.com");
  assert.equal(gold.classList.contains("jev-gold"), false);
  assert.equal(bad.classList.contains("jev-bad"), false);
  assert.equal(doc.querySelector(".jev-x"), null);
  assert.equal(gold.parentNode, doc.body);
});
