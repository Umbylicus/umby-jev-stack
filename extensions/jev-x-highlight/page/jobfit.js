(function (root) {
  "use strict";

  function featureOn(state) {
    const id = root.JEV && root.JEV.FEATURES && root.JEV.FEATURES.jobFit;
    return !!(id && root.JEV.featureOn && root.JEV.featureOn(state, id));
  }

  function parseCanDo(text) {
    if (Array.isArray(text)) {
      const out = [];
      for (let i = 0; i < text.length; i++) {
        const item = String(text[i] || "").trim();
        if (item) out.push(item);
      }
      return out;
    }
    return String(text || "").split(/[\n,]/).map(function (part) { return part.trim(); }).filter(Boolean);
  }

  function judge(line, canDo) {
    const phrases = parseCanDo(canDo);
    if (!phrases.length) return "skip";
    const text = String(line || "").replace(/\s+/g, " ").trim();
    if (text.length < 8) return "skip";
    const lower = text.toLowerCase();
    for (let i = 0; i < phrases.length; i++) {
      if (phrases[i] && lower.indexOf(phrases[i].toLowerCase()) !== -1) return "gold";
    }
    if (/\b(required|experience|must|proficient|years?)\b/i.test(text)) return "bad";
    return "skip";
  }

  function pageHref(doc) {
    const loc = (doc && doc.location) || root.location || {};
    return loc.href || "";
  }

  function controlLabel(el) {
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria && String(aria).trim()) return aria;
    if (el.tagName === "INPUT") return el.value || "";
    return el.textContent || "";
  }

  function isJob(doc) {
    let path = pageHref(doc);
    try {
      path = new URL(path, "https://jev.invalid").pathname;
    } catch (err) {
      path = pageHref(doc);
    }
    if (/job|career/i.test(path)) return true;
    if (!doc.querySelectorAll) return false;
    const headings = doc.querySelectorAll("h1, h2, h3");
    for (let i = 0; i < headings.length; i++) {
      if (/job|career/i.test(headings[i].textContent || "")) return true;
    }
    let apply = false;
    const controls = doc.querySelectorAll("button, a, input, [role=\"button\"]");
    for (let i = 0; i < controls.length; i++) {
      if (/\bapply\b/i.test(controlLabel(controls[i]))) apply = true;
    }
    return apply && !!doc.querySelector("p, li, article");
  }

  function clearMarks(doc) {
    if (!doc.querySelectorAll) return;
    const marked = doc.querySelectorAll("[data-jev-job]");
    for (let i = 0; i < marked.length; i++) {
      const kind = marked[i].getAttribute("data-jev-job");
      marked[i].removeAttribute("data-jev-job");
      if (kind === "gold") marked[i].classList.remove("jev-pass");
      if (kind === "bad" && !marked[i].hasAttribute("data-jev-must")) marked[i].classList.remove("jev-fail");
    }
  }

  function sync(state) {
    const doc = root.document;
    if (!doc) return;
    clearMarks(doc);
    if (!featureOn(state)) return;
    if (!isJob(doc)) return;
    const phrases = parseCanDo(state && state.jobCanDo);
    if (!doc.querySelectorAll) return;
    const lines = doc.querySelectorAll("li, p");
    for (let i = 0; i < lines.length; i++) {
      const el = lines[i];
      if (el.closest && el.closest(".jev-card")) continue;
      if (el.querySelector && el.querySelector("li, p")) continue;
      const verdict = judge(el.textContent || "", phrases);
      if (verdict === "gold") {
        el.classList.add("jev-pass");
        if (!el.hasAttribute("data-jev-must")) el.classList.remove("jev-fail");
        el.setAttribute("data-jev-job", "gold");
      } else if (verdict === "bad") {
        el.classList.add("jev-fail");
        el.classList.remove("jev-pass");
        el.setAttribute("data-jev-job", "bad");
      }
    }
  }

  const api = { parseCanDo: parseCanDo, judge: judge, sync: sync };
  root.JEVJob = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
