(function (root) {
  "use strict";

  function featureOn(state) {
    const id = root.JEV && root.JEV.FEATURES && root.JEV.FEATURES.pdf;
    return !!(id && root.JEV.featureOn && root.JEV.featureOn(state, id));
  }

  function asLatin1(value) {
    if (typeof value === "string") return value;
    if (value == null) return "";
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    let out = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return out;
  }

  function extractPdfText(bytesOrString) {
    const raw = asLatin1(bytesOrString);
    const parts = [];
    for (let i = 0; i < raw.length; i++) {
      if (raw.charAt(i) !== "(") continue;
      let depth = 1;
      let out = "";
      let j = i + 1;
      while (j < raw.length && depth > 0) {
        const ch = raw.charAt(j);
        if (ch === "\\") {
          const next = raw.charAt(j + 1);
          if (next === "n") out += "\n";
          else if (next === "r") out += "\r";
          else if (next === "t") out += "\t";
          else if (next === "(" || next === ")" || next === "\\") out += next;
          else if (/[0-7]/.test(next)) {
            const octal = raw.slice(j + 1, j + 4).match(/^[0-7]{1,3}/);
            if (octal) {
              out += String.fromCharCode(parseInt(octal[0], 8));
              j += octal[0].length + 1;
              continue;
            }
            out += next;
          } else out += next;
          j += 2;
          continue;
        }
        if (ch === "(") {
          depth += 1;
          out += ch;
          j += 1;
          continue;
        }
        if (ch === ")") {
          depth -= 1;
          if (depth === 0) break;
          out += ch;
          j += 1;
          continue;
        }
        out += ch;
        j += 1;
      }
      parts.push(out);
      i = j;
    }
    return parts.join("\n");
  }

  function uniqueMatches(text, pattern) {
    const out = [];
    const seen = new Set();
    const flags = pattern.flags.indexOf("g") === -1 ? pattern.flags + "g" : pattern.flags;
    const re = new RegExp(pattern.source, flags);
    let match;
    while ((match = re.exec(text))) {
      const value = match[0].trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
    return out;
  }

  function findAmounts(text) {
    return uniqueMatches(
      String(text || ""),
      /\$\s*\d+(?:,\d{3})*(?:\.\d{2})?|\bUSD\s+\d+(?:,\d{3})*(?:\.\d{2})?|€\s*\d+(?:,\d{3})*(?:\.\d{2})?/gi
    );
  }

  function findSignatures(text) {
    const lines = String(text || "").split(/\r?\n/);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (/signature|sign here|signed by/i.test(line) || /_{5,}/.test(line)) out.push(line);
    }
    return out;
  }

  function clearUi(doc) {
    const card = doc.getElementById && doc.getElementById("jev-pdf-card");
    if (card) card.remove();
    if (!doc.querySelectorAll) return;
    const marked = doc.querySelectorAll("[data-jev-pdf]");
    for (let i = 0; i < marked.length; i++) {
      marked[i].classList.remove("jev-pass", "jev-glow");
      marked[i].removeAttribute("data-jev-pdf");
    }
  }

  function sync(state) {
    const doc = root.document;
    if (!doc) return;
    if (!featureOn(state)) clearUi(doc);
  }

  const api = {
    findAmounts: findAmounts,
    findSignatures: findSignatures,
    extractPdfText: extractPdfText,
    sync: sync
  };
  root.JEVPdf = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
