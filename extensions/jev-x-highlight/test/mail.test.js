"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

require(path.join(__dirname, "..", "lib", "contract.js"));
const runtime = require(path.join(__dirname, "..", "lib", "runtime.js"));
const fs = require("fs");
const { createDocument, h } = require(path.join(__dirname, "minidom.js"));

globalThis.JEVMatch = {
  phraseHit(text, phrases) {
    const hay = String(text || "").toLowerCase();
    for (const phrase of phrases || []) {
      const needle = String(phrase || "").trim().toLowerCase();
      if (needle && hay.includes(needle)) return true;
    }
    return false;
  },
  looksLikeSpam(text) {
    return /\bact now\b/i.test(String(text || ""));
  }
};

require(path.join(__dirname, "..", "lib", "topics.js"));
const mail = require(path.join(__dirname, "..", "mail", "content.js"));

const LATE = new Date(2026, 8, 20, 23, 30, 0);

function mailState(overrides) {
  return runtime.mergeState(Object.assign({
    enabled: true,
    sites: { gmail: true, outlook: true },
    features: { mail: true, highlight: false, workHours: true },
    interests: ["roofing"],
    notInterests: ["crypto"],
    workHours: { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }
  }, overrides || {}));
}

function gmailMessage(options) {
  const doc = createDocument();
  const hash = options.hash || "#inbox";
  doc.location = {
    hostname: "mail.google.com",
    hash,
    href: "https://mail.google.com/mail/u/0/" + hash,
    pathname: "/mail/u/0/"
  };
  const row = h("tr", { class: "zA", ownerDocument: doc });
  if (options.id) row.setAttribute("data-legacy-message-id", options.id);
  if (options.messageId) row.setAttribute("data-message-id", options.messageId);
  const subjectEl = h("span", { class: "bog", ownerDocument: doc, text: options.subject || "" });
  const senderAttrs = {
    ownerDocument: doc,
    class: options.senderClass || "yP",
    text: options.sender || "Ada Lovelace"
  };
  if (options.email !== false) senderAttrs.email = options.email || "ada@example.com";
  const senderEl = h("span", senderAttrs);
  const snippetEl = h("span", { class: "y2", ownerDocument: doc, text: options.snippet || "" });
  row.append(senderEl, subjectEl, snippetEl);
  if (options.label) row.append(h("span", { title: options.label, ownerDocument: doc, text: options.label }));
  doc.body.append(row);
  return { doc, row, subjectEl, senderEl, snippetEl };
}

function outlookMessage(options) {
  const doc = createDocument();
  const href = options.href || "https://outlook.office.com/mail/inbox";
  doc.location = {
    hostname: options.hostname || "outlook.office.com",
    hash: "",
    href,
    pathname: "/mail/inbox"
  };
  const row = h("div", {
    role: "option",
    ownerDocument: doc,
    "data-convid": options.id || "conv-1",
    "aria-label": options.aria || "Sam Rivera roofing note"
  });
  const senderEl = h("span", { class: "sender", ownerDocument: doc, text: options.sender || "Sam Rivera" });
  const timeEl = h("span", { ownerDocument: doc, text: options.time || "9:04 AM" });
  const subjectEl = h("span", { class: "subject", ownerDocument: doc, text: options.subject || "Hello" });
  const snippetEl = h("span", { ownerDocument: doc, text: options.snippet || "See you then" });
  row.append(senderEl, timeEl, subjectEl, snippetEl);
  doc.body.append(row);
  return { doc, row, subjectEl, senderEl };
}

test("interest subject is gold", () => {
  const built = gmailMessage({ subject: "roofing estimate", snippet: "next week", sender: "Ada" });
  const state = mailState();
  built.row.classList.add("jev-bad");
  built.subjectEl.classList.add("jev-subject-strike");
  assert.equal(mail.classifyMessage({
    subject: "Hello",
    snippet: "roofing quote",
    sender: "Ada",
    junk: false
  }, state), "gold");
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-gold"), true);
  assert.equal(built.row.classList.contains("jev-bad"), false);
  assert.equal(built.subjectEl.classList.contains("jev-subject-strike"), false);
  assert.equal(built.doc.querySelector(".jev-x"), null);
  assert.equal(runtime.marksActive(state, LATE), false);
});

test("non-interest is bad and strikes only the subject", () => {
  const built = gmailMessage({ subject: "crypto wallet", snippet: "token launch", sender: "Ada" });
  const state = mailState();
  assert.equal(mail.classifyMessage({
    subject: "Hello",
    snippet: "there",
    sender: "crypto desk",
    junk: false
  }, state), "bad");
  assert.equal(mail.classifyMessage({
    subject: "crypto roofing",
    snippet: "",
    sender: "Ada",
    junk: false
  }, state), "bad");
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-bad"), true);
  assert.equal(built.row.classList.contains("jev-gold"), false);
  assert.equal(built.row.classList.contains("jev-subject-strike"), false);
  assert.equal(built.subjectEl.classList.contains("jev-subject-strike"), true);
  assert.equal(built.senderEl.classList.contains("jev-subject-strike"), false);
  assert.equal(built.snippetEl.classList.contains("jev-subject-strike"), false);
  assert.equal(built.doc.querySelector(".jev-x"), null);
});

test("junk is bad even when the subject matches an interest", () => {
  const state = mailState();
  const gmail = gmailMessage({ subject: "roofing estimate", snippet: "next week", hash: "#spam" });
  assert.equal(gmail.row.textContent.toLowerCase().includes("spam"), false);
  mail.apply(gmail.doc, state, LATE, "mail.google.com");
  assert.equal(gmail.row.classList.contains("jev-bad"), true);
  assert.equal(gmail.row.classList.contains("jev-gold"), false);
  assert.equal(gmail.subjectEl.classList.contains("jev-subject-strike"), true);
  assert.equal(gmail.doc.body.contains(gmail.row), true);

  const outlook = outlookMessage({
    subject: "roofing estimate",
    href: "https://outlook.live.com/mail/0/junkemail",
    hostname: "outlook.live.com"
  });
  mail.apply(outlook.doc, state, LATE, "outlook.live.com");
  assert.equal(outlook.row.classList.contains("jev-bad"), true);
  assert.equal(outlook.row.classList.contains("jev-gold"), false);
  assert.equal(outlook.subjectEl.classList.contains("jev-subject-strike"), true);

  assert.equal(mail.classifyMessage({
    subject: "roofing estimate",
    snippet: "next week",
    sender: "Ada",
    junk: true
  }, state), "bad");
});

test("spam text is bad even when the subject is an interest", () => {
  const built = gmailMessage({ subject: "roofing estimate", snippet: "Please act now" });
  mail.apply(built.doc, mailState(), LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-bad"), true);
  assert.equal(built.row.classList.contains("jev-gold"), false);
  assert.equal(built.subjectEl.classList.contains("jev-subject-strike"), true);
});

test("feature off clears and does not reapply", () => {
  const built = gmailMessage({ subject: "roofing estimate" });
  const state = mailState();
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-gold"), true);
  state.features.mail = false;
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-gold"), false);
  assert.equal(built.row.classList.contains("jev-bad"), false);
  assert.equal(built.subjectEl.classList.contains("jev-subject-strike"), false);
  assert.equal(built.doc.querySelector(".jev-gold, .jev-bad, .jev-subject-strike"), null);
  assert.equal(built.row.classList.contains("zA"), true);
});

test("gmail site switch off does not mark", () => {
  const built = gmailMessage({ subject: "roofing estimate", sender: "Ada" });
  const state = mailState();
  state.sites.gmail = false;
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-gold"), false);
  assert.equal(built.row.classList.contains("jev-bad"), false);
  state.sites.gmail = true;
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-gold"), true);
  state.sites.gmail = false;
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-gold"), false);
  assert.equal(built.subjectEl.classList.contains("jev-subject-strike"), false);
  assert.equal(built.row.classList.contains("zA"), true);
  assert.equal(built.doc.body.contains(built.row), true);
});

test("apply never removes the row", () => {
  const built = gmailMessage({ subject: "crypto wallet", snippet: "token" });
  const before = built.doc.body.children.length;
  mail.apply(built.doc, mailState(), LATE, "mail.google.com");
  assert.equal(built.doc.body.contains(built.row), true);
  assert.equal(built.row.parentNode, built.doc.body);
  assert.equal(built.doc.body.children.length, before);
  assert.equal(built.row.classList.contains("jev-bad"), true);
  assert.equal(built.doc.querySelector(".jev-x"), null);
});

test("a message that matches neither list is unmarked", () => {
  const built = gmailMessage({
    subject: "Plumbing estimate",
    snippet: "Tuesday afternoon",
    sender: "Pat"
  });
  const state = mailState();
  assert.equal(mail.classifyMessage({
    subject: "Plumbing estimate",
    snippet: "Tuesday afternoon",
    sender: "Pat",
    junk: false
  }, state), "none");
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-gold"), false);
  assert.equal(built.row.classList.contains("jev-bad"), false);
  assert.equal(built.subjectEl.classList.contains("jev-subject-strike"), false);
  assert.equal(built.doc.querySelector(".jev-gold, .jev-bad, .jev-subject-strike"), null);
});

test("mail ignores the highlight switch and work hours", () => {
  const built = gmailMessage({ subject: "roofing estimate" });
  const state = mailState();
  assert.equal(LATE.getDay(), 0);
  assert.equal(state.features.highlight, false);
  assert.equal(state.features.workHours, true);
  assert.equal(runtime.inWorkHours(state, LATE), false);
  assert.equal(runtime.marksActive(state, LATE), false);
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-gold"), true);
});

test("master switch off clears mail marks", () => {
  const built = gmailMessage({ subject: "roofing estimate" });
  const state = mailState();
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-gold"), true);
  state.enabled = false;
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-gold"), false);
  assert.equal(built.row.classList.contains("jev-bad"), false);
});

test("a non-mail site is left unmarked", () => {
  const built = gmailMessage({ subject: "roofing estimate" });
  mail.apply(built.doc, mailState(), LATE, "x.com");
  assert.equal(built.row.classList.contains("jev-gold"), false);
  assert.equal(built.row.classList.contains("jev-bad"), false);
  assert.deepEqual(mail.findMessages(built.doc, "x"), []);
});

test("findMessages reads gmail rows and outlook options", () => {
  const gmail = gmailMessage({
    subject: "roofing estimate",
    snippet: " - next week",
    sender: "Ada Lovelace",
    id: "msg-18"
  });
  const gmailFound = mail.findMessages(gmail.doc, "gmail", "mail.google.com");
  assert.equal(gmailFound.length, 1);
  assert.equal(gmailFound[0].el, gmail.row);
  assert.equal(gmailFound[0].subjectEl, gmail.subjectEl);
  assert.equal(gmailFound[0].subject, "roofing estimate");
  assert.equal(gmailFound[0].sender, "Ada Lovelace");
  assert.equal(gmailFound[0].snippet, "next week");
  assert.equal(gmailFound[0].id, "msg-18");
  assert.equal(gmailFound[0].junk, false);

  const unread = gmailMessage({
    subject: "Unread note",
    sender: "Grace",
    senderClass: "zF",
    email: false,
    messageId: "mid-9"
  });
  const unreadFound = mail.findMessages(unread.doc, "gmail")[0];
  assert.equal(unreadFound.sender, "Grace");
  assert.equal(unreadFound.id, "mid-9");

  const emailDoc = createDocument();
  const emailRow = h("tr", { class: "zA", ownerDocument: emailDoc });
  emailRow.append(
    h("span", { class: "bog", ownerDocument: emailDoc, text: "Parts" }),
    h("span", { email: "pat@example.com", ownerDocument: emailDoc, text: "Pat" })
  );
  emailDoc.body.append(emailRow);
  const emailFound = mail.findMessages(emailDoc, "gmail")[0];
  assert.equal(emailFound.sender, "Pat");
  assert.equal(emailFound.id, "Parts");

  const labeled = gmailMessage({ subject: "Hello", label: "Junk", hash: "#inbox" });
  assert.equal(mail.findMessages(labeled.doc, "gmail")[0].junk, true);

  const outlook = outlookMessage({
    subject: "Monopoly rent",
    sender: "Sam Rivera",
    snippet: "Board is free",
    id: "conv-9"
  });
  const outlookFound = mail.findMessages(outlook.doc, "outlook", "outlook.office.com")[0];
  assert.equal(outlookFound.sender, "Sam Rivera");
  assert.equal(outlookFound.subject, "Monopoly rent");
  assert.equal(outlookFound.subjectEl, outlook.subjectEl);
  assert.equal(outlookFound.snippet, "Board is free");
  assert.equal(outlookFound.id, "conv-9");
  assert.equal(outlookFound.junk, false);

  const ariaDoc = createDocument();
  const ariaRow = h("div", {
    role: "option",
    ownerDocument: ariaDoc,
    "data-convid": "conv-aria",
    "aria-label": "Sam Rivera, Monopoly rent, Board is free"
  });
  ariaDoc.body.append(ariaRow);
  const ariaFound = mail.findMessages(ariaDoc, "outlook")[0];
  assert.equal(ariaFound.sender, "Sam Rivera");
  assert.equal(ariaFound.subject, "Monopoly rent");
  assert.equal(ariaFound.snippet, "Board is free");
  assert.equal(ariaFound.id, "conv-aria");
  assert.equal(ariaFound.subjectEl, null);

  const senderOnly = createDocument();
  const senderRow = h("div", {
    role: "option",
    ownerDocument: senderOnly,
    "aria-label": "Sam Rivera, Monopoly rent, Board is free"
  });
  const senderSpan = h("span", { class: "sender", ownerDocument: senderOnly, text: "Sam Rivera" });
  senderRow.append(senderSpan);
  senderOnly.body.append(senderRow);
  const senderFound = mail.findMessages(senderOnly, "outlook")[0];
  assert.equal(senderFound.sender, "Sam Rivera");
  assert.equal(senderFound.subject, "Monopoly rent");
  assert.equal(senderFound.snippet, "Board is free");
  assert.equal(senderFound.subjectEl, null);

  const titleDoc = createDocument();
  const titleRow = h("tr", { class: "zA", ownerDocument: titleDoc });
  titleRow.append(
    h("span", { class: "yP", ownerDocument: titleDoc, text: "Ada" }),
    h("span", { class: "bog", ownerDocument: titleDoc, text: "roofing estimate" }),
    h("span", { title: "Spam", ownerDocument: titleDoc })
  );
  titleDoc.body.append(titleRow);
  assert.equal(titleRow.textContent.toLowerCase().includes("spam"), false);
  assert.equal(mail.findMessages(titleDoc, "gmail")[0].junk, true);

  const hashDoc = createDocument();
  const hashRow = h("tr", { class: "zA", ownerDocument: hashDoc });
  hashRow.append(h("span", { class: "bog", ownerDocument: hashDoc, text: "roofing estimate" }));
  hashDoc.body.append(hashRow);
  assert.equal(mail.findMessages(hashDoc, "gmail", "mail.google.com", "#spam")[0].junk, true);
  assert.equal(mail.findMessages(hashDoc, "gmail", "mail.google.com", "#inbox")[0].junk, false);

  const nameDoc = createDocument();
  const nameRow = h("tr", { class: "zA", ownerDocument: nameDoc });
  nameRow.append(
    h("span", { class: "yP", ownerDocument: nameDoc, text: "Junko" }),
    h("span", { class: "bog", ownerDocument: nameDoc, text: "antispam notes" })
  );
  nameDoc.body.append(nameRow);
  assert.equal(mail.findMessages(nameDoc, "gmail", "mail.google.com", "#inbox")[0].junk, false);

  const junko = outlookMessage({
    sender: "Junko",
    subject: "Hello",
    aria: "Junko, Hello, See you then"
  });
  const junkoFound = mail.findMessages(junko.doc, "outlook", "outlook.office.com")[0];
  assert.equal(junkoFound.sender, "Junko");
  assert.equal(junkoFound.junk, false);
  assert.equal(junkoFound.el.getAttribute("role"), "option");

  const empty = createDocument();
  assert.deepEqual(mail.findMessages(empty, "gmail"), []);
  assert.deepEqual(mail.findMessages(empty, "outlook"), []);
  assert.deepEqual(mail.findMessages(empty, "linkedin"), []);
});

test("rows in one list are marked independently", () => {
  const doc = createDocument();
  doc.location = { hostname: "mail.google.com", hash: "#inbox", href: "https://mail.google.com/mail/u/0/#inbox" };
  function row(subject, id) {
    const el = h("tr", { class: "zA", ownerDocument: doc, "data-legacy-message-id": id });
    const subjectEl = h("span", { class: "bog", ownerDocument: doc, text: subject });
    el.append(
      h("span", { class: "yP", ownerDocument: doc, text: "Ada" }),
      subjectEl,
      h("span", { class: "y2", ownerDocument: doc, text: "note" })
    );
    doc.body.append(el);
    return { el, subjectEl };
  }
  const gold = row("roofing estimate", "a");
  const bad = row("crypto wallet", "b");
  const plain = row("Lunch Tuesday", "c");
  const before = doc.body.children.length;
  mail.apply(doc, mailState(), LATE, "mail.google.com");
  assert.equal(gold.el.classList.contains("jev-gold"), true);
  assert.equal(gold.subjectEl.classList.contains("jev-subject-strike"), false);
  assert.equal(bad.el.classList.contains("jev-bad"), true);
  assert.equal(bad.subjectEl.classList.contains("jev-subject-strike"), true);
  assert.equal(plain.el.classList.contains("jev-gold"), false);
  assert.equal(plain.el.classList.contains("jev-bad"), false);
  assert.equal(plain.subjectEl.classList.contains("jev-subject-strike"), false);
  assert.equal(doc.body.children.length, before);
});

test("outlook interest is gold without removing the option", () => {
  const built = outlookMessage({ subject: "roofing bid", hostname: "outlook.office365.com" });
  const before = built.doc.body.children.length;
  mail.apply(built.doc, mailState(), LATE, "outlook.office365.com");
  assert.equal(built.row.classList.contains("jev-gold"), true);
  assert.equal(built.subjectEl.classList.contains("jev-subject-strike"), false);
  assert.equal(built.doc.body.contains(built.row), true);
  assert.equal(built.doc.body.children.length, before);
});

test("topic id ai marks artificial intelligence gold", () => {
  const built = gmailMessage({
    subject: "quarterly artificial intelligence plan",
    snippet: "notes",
    sender: "Ada"
  });
  const state = mailState({ interests: ["ai"] });
  assert.equal(typeof globalThis.JEVTopics.phrasesFor, "function");
  assert.equal(mail.classifyMessage({
    subject: "quarterly artificial intelligence plan",
    snippet: "notes",
    sender: "Ada",
    junk: false
  }, state), "gold");
  const before = built.doc.body.children.length;
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-gold"), true);
  assert.equal(built.row.classList.contains("jev-bad"), false);
  assert.equal(built.subjectEl.classList.contains("jev-subject-strike"), false);
  assert.equal(built.doc.body.contains(built.row), true);
  assert.equal(built.doc.body.children.length, before);
});

test("topic id personal-finance marks credit card mail bad", () => {
  const built = gmailMessage({ subject: "credit card payment", snippet: "due Friday", sender: "Ada" });
  const state = mailState({ interests: ["roofing"], notInterests: ["personal-finance"] });
  assert.equal(mail.classifyMessage({
    subject: "credit card payment",
    snippet: "due Friday",
    sender: "Ada",
    junk: false
  }, state), "bad");
  mail.apply(built.doc, state, LATE, "mail.google.com");
  assert.equal(built.row.classList.contains("jev-bad"), true);
  assert.equal(built.row.classList.contains("jev-gold"), false);
  assert.equal(built.subjectEl.classList.contains("jev-subject-strike"), true);
  assert.equal(built.senderEl.classList.contains("jev-subject-strike"), false);
});

test("main-table row without bog yields the subject from role=link", () => {
  const doc = createDocument();
  doc.location = {
    hostname: "mail.google.com",
    hash: "#inbox",
    href: "https://mail.google.com/mail/u/0/#inbox",
    pathname: "/mail/u/0/"
  };
  const main = h("div", { role: "main", ownerDocument: doc });
  const row = h("tr", { role: "row", ownerDocument: doc });
  const senderEl = h("span", { class: "yP", email: "ada@example.com", ownerDocument: doc, text: "Ada Lovelace" });
  const subjectEl = h("td", { role: "link", ownerDocument: doc, text: "roofing estimate" });
  const snippetEl = h("span", { class: "y2", ownerDocument: doc, text: " - next week" });
  row.append(senderEl, subjectEl, snippetEl);
  main.append(h("table", { ownerDocument: doc }).append(row));
  doc.body.append(main);
  assert.equal(row.querySelector(".bog"), null);
  const found = mail.findMessages(doc, "gmail", "mail.google.com");
  assert.equal(found.length, 1);
  assert.equal(found[0].el, row);
  assert.equal(found[0].subjectEl, subjectEl);
  assert.equal(found[0].subject, "roofing estimate");
  assert.equal(found[0].sender, "Ada Lovelace");
  assert.equal(found[0].snippet, "next week");
  const before = doc.body.children.length;
  mail.apply(doc, mailState(), LATE, "mail.google.com");
  assert.equal(row.classList.contains("jev-gold"), true);
  assert.equal(subjectEl.classList.contains("jev-subject-strike"), false);
  assert.equal(doc.body.contains(row), true);
  assert.equal(doc.body.children.length, before);

  const threadDoc = createDocument();
  const threadMain = h("div", { role: "main", ownerDocument: threadDoc });
  const threadRow = h("tr", { role: "row", ownerDocument: threadDoc });
  const threadEl = h("span", { "data-thread-id": "thread-1", ownerDocument: threadDoc, text: "thread subject" });
  threadRow.append(h("span", { class: "zF", ownerDocument: threadDoc, text: "Grace" }), threadEl);
  const lineRow = h("tr", { role: "row", ownerDocument: threadDoc });
  const lineEl = h("div", { ownerDocument: threadDoc, text: "plain subject line" });
  lineRow.append(h("span", { ownerDocument: threadDoc, text: "9:04 AM" }), lineEl);
  threadMain.append(threadRow, lineRow);
  threadDoc.body.append(threadMain);
  const threads = mail.findMessages(threadDoc, "gmail");
  assert.equal(threads.length, 2);
  assert.equal(threads[0].subject, "thread subject");
  assert.equal(threads[0].subjectEl, threadEl);
  assert.equal(threads[0].sender, "Grace");
  assert.equal(threads[1].subject, "plain subject line");
  assert.equal(threads[1].subjectEl, lineEl);
});

test("open gmail message body is not a list row", () => {
  const doc = createDocument();
  doc.location = {
    hostname: "mail.google.com",
    hash: "#inbox/abc",
    href: "https://mail.google.com/mail/u/0/#inbox/abc",
    pathname: "/mail/u/0/"
  };
  const main = h("div", { role: "main", ownerDocument: doc });
  const opened = h("div", { class: "adn", ownerDocument: doc });
  const body = h("div", { class: "a3s", ownerDocument: doc });
  const inner = h("tr", { role: "row", ownerDocument: doc });
  inner.append(h("span", { role: "link", ownerDocument: doc, text: "quarterly artificial intelligence plan" }));
  const legacy = h("tr", { class: "zA", ownerDocument: doc });
  legacy.append(h("span", { class: "bog", ownerDocument: doc, text: "quarterly artificial intelligence plan" }));
  body.append(inner, legacy);
  opened.append(body);
  const list = h("tr", { role: "row", ownerDocument: doc });
  const listSubject = h("span", { role: "link", ownerDocument: doc, text: "Lunch Tuesday" });
  list.append(h("span", { class: "yP", ownerDocument: doc, text: "Pat" }), listSubject);
  main.append(opened, h("table", { ownerDocument: doc }).append(list));
  doc.body.append(main);
  const before = doc.body.children.length;
  const found = mail.findMessages(doc, "gmail", "mail.google.com");
  assert.equal(found.length, 1);
  assert.equal(found[0].el, list);
  assert.equal(found[0].subject, "Lunch Tuesday");
  mail.apply(doc, mailState({ interests: ["ai"] }), LATE, "mail.google.com");
  assert.equal(body.classList.contains("jev-gold"), false);
  assert.equal(body.classList.contains("jev-bad"), false);
  assert.equal(body.classList.contains("jev-subject-strike"), false);
  assert.equal(inner.classList.contains("jev-gold"), false);
  assert.equal(inner.classList.contains("jev-bad"), false);
  assert.equal(legacy.classList.contains("jev-gold"), false);
  assert.equal(opened.classList.contains("jev-gold"), false);
  assert.equal(list.classList.contains("jev-gold"), false);
  assert.equal(doc.body.contains(inner), true);
  assert.equal(doc.body.contains(legacy), true);
  assert.equal(doc.body.contains(list), true);
  assert.equal(doc.body.children.length, before);
});

test("collapsed gmail rows get a cell background and social classes stay", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "highlight.css"), "utf8");
  assert.match(css, /tr\.jev-gold\s+td\s*\{[^}]*background/);
  assert.match(css, /tr\.jev-bad\s+td\s*\{[^}]*background/);
  assert.match(css, /\.jev-subject-strike\s*\{[^}]*line-through/);
  assert.match(css, /\.jev-gold\s*\{[^}]*outline/);
  assert.match(css, /\.jev-blur\s*\{/);
  assert.match(css, /\.jev-x\s*\{/);
});
