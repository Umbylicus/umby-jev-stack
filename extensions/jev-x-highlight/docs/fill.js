(function (root) {
  "use strict";

  const INFO_ROLES = ["name", "email", "phone", "address"];
  const BUSINESS_ROLES = ["businessName", "businessPhone", "businessAddress"];
  const ROLE_LABELS = {
    name: "Name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    businessName: "Business name",
    businessPhone: "Business phone",
    businessAddress: "Business address"
  };
  const BLOCKED_TYPES = ["password", "hidden", "file", "search", "submit", "button", "reset", "image", "checkbox", "radio"];

  function featureOn(state, id) {
    return !!(root.JEV && typeof root.JEV.featureOn === "function" && root.JEV.featureOn(state, id));
  }

  function fieldText(field) {
    return [field.type, field.name, field.id, field.autocomplete, field.label, field.placeholder]
      .map((part) => String(part || "").toLowerCase().replace(/[_./]+/g, " ").replace(/-+/g, " "))
      .join(" ");
  }

  function businessContext(text) {
    return /\b(business|company|organization|organisation|employer|work|office)\b/.test(text);
  }

  function classifyField(field) {
    const src = field || {};
    const type = String(src.type || "").trim().toLowerCase();
    const raw = [src.type, src.name, src.id, src.autocomplete, src.label, src.placeholder].join(" ").toLowerCase();
    const text = fieldText(src);
    if (BLOCKED_TYPES.includes(type)) return "";
    if (/\b(password|passwd)\b/.test(text)) return "";
    if (/cc-|cc number|cc name|cc exp|cc csc/.test(raw) || /\b(credit card|card number|cardnumber|cvv|cvc|security code)\b/.test(text)) return "";

    const email = type === "email" || /\b(e mail|email)\b/.test(text);
    if (email) return "email";

    const phone = type === "tel" || /\b(phone|mobile|cell|telephone|tel)\b/.test(text);
    if (phone) return businessContext(text) ? "businessPhone" : "phone";

    const address = /\b(street address|address|street|addr)\b/.test(text);
    if (address) return businessContext(text) ? "businessAddress" : "address";

    if (/\b(user name|username|login|screen name)\b/.test(text)) return "";
    if (businessContext(text) || /\borg\b/.test(text)) return "businessName";
    if (/\b(full name|first name|last name|given name|family name|your name)\b/.test(text)) return "name";
    if (text.split(/[^a-z0-9]+/).includes("name")) return "name";
    return "";
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function findLabel(el) {
    const doc = el.ownerDocument;
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria) return clean(aria);
    const labelledby = el.getAttribute && el.getAttribute("aria-labelledby");
    if (labelledby && doc && typeof doc.getElementById === "function") {
      const text = labelledby.split(/\s+/).map((id) => {
        const node = doc.getElementById(id);
        return node ? node.textContent : "";
      }).join(" ");
      if (clean(text)) return clean(text);
    }
    if (doc && el.id && typeof doc.querySelectorAll === "function") {
      const labels = doc.querySelectorAll("label");
      for (const label of labels) {
        if (label.getAttribute("for") === el.id) return clean(label.textContent);
      }
    }
    let parent = el.parentElement;
    while (parent) {
      if (parent.tagName === "LABEL") return clean(parent.textContent);
      parent = parent.parentElement;
    }
    return "";
  }

  function readField(el) {
    const tag = el.tagName || "";
    let type = String((el.getAttribute && el.getAttribute("type")) || el.type || "").toLowerCase();
    if (!type && tag === "TEXTAREA") type = "textarea";
    if (!type && tag === "SELECT") type = "select";
    if (!type) type = "text";
    return {
      type,
      name: (el.getAttribute && el.getAttribute("name")) || "",
      id: el.id || (el.getAttribute && el.getAttribute("id")) || "",
      autocomplete: (el.getAttribute && el.getAttribute("autocomplete")) || "",
      placeholder: (el.getAttribute && el.getAttribute("placeholder")) || "",
      label: findLabel(el)
    };
  }

  function fieldsFor(doc, mode) {
    if (!doc || typeof doc.querySelectorAll !== "function") return [];
    const allowed = new Set(mode === "business" ? BUSINESS_ROLES : INFO_ROLES);
    const out = [];
    for (const el of doc.querySelectorAll("input, textarea, select")) {
      if (el.closest && el.closest(".jev-card")) continue;
      const meta = readField(el);
      if (el.tagName === "INPUT" && BLOCKED_TYPES.includes(meta.type)) continue;
      const role = classifyField(meta);
      if (!allowed.has(role)) continue;
      out.push({ el, role, label: meta.label || ROLE_LABELS[role] });
    }
    return out;
  }

  function fire(el, type) {
    if (typeof Event === "function") {
      try {
        el.dispatchEvent(new Event(type, { bubbles: true }));
        return;
      } catch (err) {
        // Mini DOM and non-browser callers take the plain event below.
      }
    }
    if (typeof el.dispatchEvent === "function") {
      el.dispatchEvent({ type, bubbles: true, target: el, preventDefault() {} });
    }
  }

  function applyValue(el, value) {
    if (!el) return;
    const text = String(value);
    const proto = Object.getPrototypeOf(el);
    const desc = proto && Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && typeof desc.set === "function") desc.set.call(el, text);
    else el.value = text;
    if (typeof el.setAttribute === "function") el.setAttribute("value", text);
    fire(el, "input");
    fire(el, "change");
  }

  function valueFor(state, role) {
    const profile = (state && state.profile) || {};
    const business = (state && state.business) || {};
    const map = {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      businessName: business.name,
      businessPhone: business.phone,
      businessAddress: business.address
    };
    return map[role] == null ? "" : String(map[role]);
  }

  function removeCard(doc, id) {
    const card = doc.getElementById && doc.getElementById(id);
    if (card) card.remove();
  }

  function renderCard(doc, id, title, rows, corner) {
    removeCard(doc, id);
    const card = doc.createElement("section");
    card.id = id;
    card.className = "jev-card";
    card.setAttribute("data-jev-card", id === "jev-fill-info" ? "fill-info" : "fill-business");
    card.setAttribute("aria-label", title);
    card.style.left = corner.left;
    card.style.right = corner.right;
    card.style.top = corner.top;
    card.style.bottom = corner.bottom;
    const heading = doc.createElement("h2");
    heading.textContent = title;
    card.appendChild(heading);
    for (const row of rows) card.appendChild(row);
    doc.body.appendChild(card);
    return card;
  }

  function rowFor(doc, state, field) {
    const row = doc.createElement("div");
    row.className = "jev-fill-row";
    const label = doc.createElement("span");
    label.textContent = field.label || ROLE_LABELS[field.role] || field.role;
    const shown = doc.createElement("span");
    const value = valueFor(state, field.role);
    shown.textContent = String(value).trim() ? value : "Add this in Setup";
    const button = doc.createElement("button");
    button.setAttribute("type", "button");
    button.textContent = "Fill this field";
    button.addEventListener("click", (event) => {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      if (event && typeof event.stopPropagation === "function") event.stopPropagation();
      const next = valueFor(state, field.role);
      if (!String(next).trim()) return;
      applyValue(field.el, next);
    });
    row.append(label, shown, button);
    return row;
  }

  function syncMode(state, mode) {
    const doc = root.document;
    if (!doc || !doc.body) return;
    const info = mode === "info";
    const id = info ? "jev-fill-info" : "jev-fill-business";
    const enabled = featureOn(state, info ? "fillInfo" : "fillBusiness");
    if (!enabled) {
      removeCard(doc, id);
      return;
    }
    const rows = fieldsFor(doc, info ? "info" : "business").map((field) => rowFor(doc, state, field));
    const corner = info
      ? { left: "16px", right: "auto", top: "auto", bottom: "16px" }
      : { left: "16px", right: "auto", top: "16px", bottom: "auto" };
    renderCard(doc, id, info ? "Fill my info" : "Fill my business", rows, corner);
  }

  function sync(state) {
    syncMode(state, "info");
    syncMode(state, "business");
  }

  const api = { classifyField, fieldsFor, applyValue, sync };
  root.JEVFill = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
