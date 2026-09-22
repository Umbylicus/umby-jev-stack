"use strict";

class ClassList {
  constructor(el) {
    this.el = el;
    this.set = new Set();
  }
  _sync() {
    this.el._className = [...this.set].join(" ");
  }
  add(...names) {
    for (const name of names) if (name) this.set.add(name);
    this._sync();
  }
  remove(...names) {
    for (const name of names) this.set.delete(name);
    this._sync();
  }
  contains(name) {
    return this.set.has(name);
  }
  toggle(name, force) {
    if (force === true) {
      this.add(name);
      return true;
    }
    if (force === false) {
      this.remove(name);
      return false;
    }
    if (this.contains(name)) {
      this.remove(name);
      return false;
    }
    this.add(name);
    return true;
  }
}

class NodeBase {
  constructor(doc) {
    this.ownerDocument = doc;
    this.parentElement = null;
    this.parentNode = null;
    this.childNodes = [];
  }
  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }
  get textContent() {
    if (this.nodeType === 3) return this.nodeValue;
    return this.childNodes.map((node) => node.textContent || "").join("");
  }
  set textContent(value) {
    if (this.nodeType === 3) {
      this.nodeValue = String(value);
      return;
    }
    this.childNodes = [];
    if (value) this.append(this.ownerDocument.createTextNode(String(value)));
  }
  get innerText() {
    return this.textContent;
  }
  append(...nodes) {
    for (const node of nodes) this._attach(node);
    return this;
  }
  _attach(node) {
    const child = typeof node === "string" ? this.ownerDocument.createTextNode(node) : node;
    if (child.parentElement) child.remove();
    child.parentElement = this.nodeType === 1 ? this : null;
    child.parentNode = this;
    this.childNodes.push(child);
  }
  remove() {
    const parent = this.parentNode;
    if (!parent) return;
    parent.childNodes = parent.childNodes.filter((node) => node !== this);
    this.parentElement = null;
    this.parentNode = null;
  }
  contains(node) {
    if (node === this) return true;
    for (const child of this.childNodes) {
      if (child.contains && child.contains(node)) return true;
    }
    return false;
  }
}

class TextNode extends NodeBase {
  constructor(doc, value) {
    super(doc);
    this.nodeType = 3;
    this.nodeValue = String(value);
  }
}

class Element extends NodeBase {
  constructor(doc, tag) {
    super(doc);
    this.nodeType = 1;
    this.tagName = String(tag || "div").toUpperCase();
    this.attributes = {};
    this.classList = new ClassList(this);
    this._className = "";
    this.style = {};
    this.listeners = {};
    this.value = "";
    this.checked = false;
    this.hidden = false;
    this.id = "";
  }
  get className() {
    return this._className;
  }
  set className(value) {
    this.classList.set = new Set(String(value || "").split(/\s+/).filter(Boolean));
    this.classList._sync();
  }
  get dataset() {
    const data = {};
    for (const [key, value] of Object.entries(this.attributes)) {
      if (key.startsWith("data-")) data[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
    return data;
  }
  setAttribute(name, value) {
    const key = String(name);
    this.attributes[key] = String(value);
    if (key === "id") this.id = String(value);
    if (key === "class") this.className = String(value);
    if (key === "value") this.value = String(value);
  }
  getAttribute(name) {
    if (name === "class") return this.className;
    if (name === "id") return this.id || null;
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }
  hasAttribute(name) {
    return this.getAttribute(name) !== null;
  }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name === "id") this.id = "";
  }
  matches(selector) {
    return splitList(selector).some((part) => matchesChain(this, parseChain(part)));
  }
  closest(selector) {
    let node = this;
    while (node && node.nodeType === 1) {
      if (node.matches(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const out = [];
    const alternatives = splitList(selector);
    walk(this, (node) => {
      if (node === this || node.nodeType !== 1) return;
      if (alternatives.some((part) => matchesChain(node, parseChain(part)))) out.push(node);
    });
    return out;
  }
  getBoundingClientRect() {
    return { x: 0, y: 0, top: 8, left: 8, bottom: 80, right: 320, width: 312, height: 72 };
  }
  addEventListener(type, fn) {
    (this.listeners[type] || (this.listeners[type] = [])).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== fn);
  }
  dispatchEvent(event) {
    const type = typeof event === "string" ? event : event.type;
    const payload = typeof event === "string" ? { type, target: this, currentTarget: this, preventDefault() {} } : event;
    payload.target = payload.target || this;
    payload.currentTarget = this;
    for (const fn of this.listeners[type] || []) fn(payload);
    return true;
  }
  click() {
    this.dispatchEvent("click");
  }
  focus() {
    this.ownerDocument.activeElement = this;
  }
  appendChild(node) {
    this.append(node);
    return node;
  }
  insertBefore(node, anchor) {
    if (node.parentNode) node.remove();
    node.parentNode = this;
    node.parentElement = this;
    const index = this.childNodes.indexOf(anchor);
    if (index < 0) this.childNodes.push(node);
    else this.childNodes.splice(index, 0, node);
    return node;
  }
  get innerHTML() {
    return this.textContent;
  }
  set innerHTML(value) {
    this.textContent = String(value).replace(/<[^>]+>/g, "");
  }
}

class Document extends Element {
  constructor() {
    super(null, "document");
    this.ownerDocument = this;
    this.nodeType = 9;
    this.documentElement = new Element(this, "html");
    this.head = new Element(this, "head");
    this.body = new Element(this, "body");
    this.documentElement.append(this.head, this.body);
    this.activeElement = this.body;
    this.defaultView = { getSelection: () => this._selection || { toString: () => "", rangeCount: 0 } };
    this._selection = null;
  }
  createElement(tag) {
    return new Element(this, tag);
  }
  createTextNode(value) {
    return new TextNode(this, value);
  }
  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }
  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }
  addEventListener(type, fn) {
    this.documentElement.addEventListener(type, fn);
  }
  getElementById(id) {
    return this.querySelector("#" + id);
  }
}

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes || []) walk(child, visit);
}

function splitList(selector) {
  const parts = [];
  let current = "";
  let quote = false;
  for (const ch of String(selector)) {
    if (ch === '"') quote = !quote;
    if (!quote && ch === ",") {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length ? parts : ["*"];
}

function parseChain(selector) {
  const steps = [];
  let current = "";
  let quote = false;
  let combinator = " ";
  const flush = (next) => {
    if (current.trim()) steps.push({ combinator, sel: current.trim() });
    current = "";
    combinator = next;
  };
  for (const ch of selector) {
    if (ch === '"') quote = !quote;
    if (!quote && ch === ">") {
      flush(">");
      continue;
    }
    if (!quote && /\s/.test(ch)) {
      if (current.trim()) flush(" ");
      continue;
    }
    current += ch;
  }
  if (current.trim()) steps.push({ combinator, sel: current.trim() });
  return steps;
}

function matchesChain(el, chain) {
  if (!chain.length) return false;
  const last = chain[chain.length - 1];
  if (!matchesCompound(el, last.sel)) return false;
  if (chain.length === 1) return true;
  const rest = chain.slice(0, -1);
  if (last.combinator === ">") return !!(el.parentElement && matchesChain(el.parentElement, rest));
  let parent = el.parentElement;
  while (parent && parent.nodeType === 1) {
    if (matchesChain(parent, rest)) return true;
    parent = parent.parentElement;
  }
  return false;
}

function matchesCompound(el, selector) {
  if (!selector || selector === "*") return true;
  const tokens = tokenize(selector);
  if (!tokens.length) return false;
  let tag = null;
  const classes = [];
  let id = null;
  const attrs = [];
  for (const token of tokens) {
    if (token.kind === "tag") tag = token.value;
    else if (token.kind === "class") classes.push(token.value);
    else if (token.kind === "id") id = token.value;
    else if (token.kind === "attr") attrs.push(token);
  }
  if (tag && el.tagName.toLowerCase() !== tag) return false;
  if (id && el.id !== id) return false;
  for (const name of classes) if (!el.classList.contains(name)) return false;
  for (const attr of attrs) {
    const value = el.getAttribute(attr.name);
    if (value === null) return false;
    if (attr.op === "=" && value !== attr.value) return false;
    if (attr.op === "*=" && !value.includes(attr.value)) return false;
    if (attr.op === "^=" && !value.startsWith(attr.value)) return false;
    if (attr.op === "$=" && !value.endsWith(attr.value)) return false;
  }
  return true;
}

function tokenize(selector) {
  const tokens = [];
  const re = /([#.])?([A-Za-z0-9_-]+)|\[\s*([A-Za-z0-9_-]+)\s*(?:([*^$]?=)\s*"([^"]*)")?\s*\]/g;
  let match;
  while ((match = re.exec(selector))) {
    if (match[3]) {
      tokens.push({ kind: "attr", name: match[3], op: match[4] || "", value: match[5] || "" });
    } else if (match[1] === ".") {
      tokens.push({ kind: "class", value: match[2] });
    } else if (match[1] === "#") {
      tokens.push({ kind: "id", value: match[2] });
    } else if (match[2]) {
      tokens.push({ kind: "tag", value: match[2].toLowerCase() });
    }
  }
  return tokens;
}

function h(tag, props) {
  const doc = (props && props.ownerDocument) || createDocument();
  const el = doc.createElement(tag);
  const attrs = props || {};
  const children = Array.prototype.slice.call(arguments, 2);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "ownerDocument") continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child);
  }
  return el;
}

function createDocument() {
  return new Document();
}

module.exports = { createDocument, h, Element };
