(function (root) {
  "use strict";

  function readSrc() {
    try {
      const search = root.location && root.location.search ? root.location.search : "";
      return new URLSearchParams(search).get("src") || "";
    } catch (err) {
      return "";
    }
  }

  function safeUrl(src) {
    try {
      const base = root.location && root.location.href ? root.location.href : "https://jev.invalid/";
      const url = new URL(src, base);
      if (
        url.protocol === "http:" ||
        url.protocol === "https:" ||
        url.protocol === "blob:" ||
        url.protocol === "file:" ||
        url.protocol === "chrome-extension:"
      ) return url.href;
    } catch (err) {
      return "";
    }
    return "";
  }

  function vendor(file) {
    const chrome = root.chrome;
    if (chrome && chrome.runtime && typeof chrome.runtime.getURL === "function") {
      return chrome.runtime.getURL("vendor/pdfjs/" + file);
    }
    return "vendor/pdfjs/" + file;
  }

  function assign(src) {
    if (root.location) root.location.href = src;
  }

  function openInBrowser(src) {
    const href = safeUrl(src);
    if (!href) return;
    const send = root.chrome && root.chrome.runtime && root.chrome.runtime.sendMessage;
    const payload = { type: root.JEV && root.JEV.MSG ? root.JEV.MSG.PDF_BYPASS : "jev-pdf-bypass", url: src };
    try {
      if (typeof send === "function") {
        const result = send(payload);
        if (result && typeof result.then === "function") {
          result.then(function () { assign(href); }, function () { assign(href); });
          return;
        }
      }
    } catch (err) {
      assign(href);
      return;
    }
    assign(href);
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function addText(parent, tag, text) {
    const el = root.document.createElement(tag);
    el.textContent = text;
    parent.append(el);
    return el;
  }

  function renderEscape(app, src) {
    clear(app);
    addText(app, "p", "PDF highlights are off.");
    const href = safeUrl(src);
    if (!href) return;
    const link = root.document.createElement("a");
    link.href = href;
    link.textContent = "Back to PDF";
    app.append(link);
  }

  function fillList(list, values, className) {
    clear(list);
    for (let i = 0; i < values.length; i++) {
      const item = root.document.createElement("li");
      item.className = className;
      item.textContent = values[i];
      list.append(item);
    }
  }

  function paintLayer(layer, amounts, signatures) {
    if (!layer.querySelectorAll) return;
    const spans = layer.querySelectorAll("span");
    for (let i = 0; i < spans.length; i++) {
      const value = spans[i].textContent || "";
      if (!value.trim()) continue;
      for (let a = 0; a < amounts.length; a++) {
        if (value.indexOf(amounts[a]) !== -1) spans[i].classList.add("jev-pass");
      }
      if (/signature|sign here|signed by|_{5,}/i.test(value)) spans[i].classList.add("jev-glow");
      for (let s = 0; s < signatures.length; s++) {
        if (value.indexOf(signatures[s]) !== -1) spans[i].classList.add("jev-glow");
      }
    }
  }

  function loadPdfJs() {
    if (root.pdfjsLib) return Promise.resolve(root.pdfjsLib);
    return new Promise(function (resolve, reject) {
      const script = root.document.createElement("script");
      script.src = vendor("pdf.min.js");
      script.onload = function () {
        if (root.pdfjsLib) resolve(root.pdfjsLib);
        else reject(new Error("pdf.js missing"));
      };
      script.onerror = function () { reject(new Error("pdf.js failed")); };
      (root.document.head || root.document.documentElement).append(script);
    });
  }

  function renderPages(lib, bytes, host, amounts, signatures) {
    lib.GlobalWorkerOptions.workerSrc = vendor("pdf.worker.min.js");
    const task = lib.getDocument({ data: bytes.slice(0), isEvalSupported: false });
    return task.promise.then(function (pdf) {
      const jobs = [];
      function next(pageNumber) {
        if (pageNumber > pdf.numPages) return Promise.resolve();
        return pdf.getPage(pageNumber).then(function (page) {
          const viewport = page.getViewport({ scale: 1.25 });
          const wrap = root.document.createElement("div");
          wrap.className = "jev-pdf-page";
          wrap.style.width = viewport.width + "px";
          wrap.style.height = viewport.height + "px";
          const canvas = root.document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const textLayer = root.document.createElement("div");
          textLayer.className = "textLayer";
          textLayer.style.setProperty("--scale-factor", String(viewport.scale));
          wrap.append(canvas, textLayer);
          host.append(wrap);
          const ctx = canvas.getContext("2d");
          return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
            return page.getTextContent();
          }).then(function (textContent) {
            const rendered = lib.renderTextLayer({
              textContentSource: textContent,
              container: textLayer,
              viewport: viewport,
              textDivs: []
            });
            const done = rendered && rendered.promise ? rendered.promise : Promise.resolve();
            return done.then(function () {
              paintLayer(textLayer, amounts, signatures);
              const bits = [];
              const items = textContent.items || [];
              for (let i = 0; i < items.length; i++) bits.push(items[i].str || "");
              return bits.join("\n");
            });
          }).then(function (text) {
            jobs.push(text);
            return next(pageNumber + 1);
          });
        });
      }
      return next(1).then(function () { return jobs.join("\n"); });
    });
  }

  let viewerLive = false;
  let viewerAbort = null;

  function stopViewer() {
    if (viewerAbort) {
      viewerAbort.abort();
      viewerAbort = null;
    }
  }

  function renderViewer(app, src) {
    const doc = root.document;
    clear(app);
    stopViewer();
    viewerAbort = typeof AbortController === "function" ? new AbortController() : null;
    const signal = viewerAbort ? viewerAbort.signal : undefined;
    const toolbar = doc.createElement("div");
    toolbar.id = "jev-pdf-toolbar";
    const open = doc.createElement("button");
    open.id = "jev-pdf-open";
    open.setAttribute("type", "button");
    open.textContent = "Open in browser";
    open.addEventListener("click", function () { openInBrowser(src); });
    toolbar.append(open);
    const amounts = doc.createElement("ul");
    amounts.id = "jev-pdf-amounts";
    const signatures = doc.createElement("ul");
    signatures.id = "jev-pdf-signatures";
    const pages = doc.createElement("div");
    pages.id = "jev-pdf-pages";
    const status = doc.createElement("p");
    app.append(toolbar, status, amounts, signatures, pages);
    const href = safeUrl(src);
    if (!href) {
      status.textContent = "No PDF selected.";
      return;
    }
    status.textContent = "Reading PDF…";
    fetch(href, signal ? { signal: signal } : undefined).then(function (response) {
      if (!viewerLive) return null;
      if (!response.ok) throw new Error("Could not read this PDF.");
      return response.arrayBuffer();
    }).then(function (buffer) {
      if (!viewerLive || !buffer) return;
      const bytes = new Uint8Array(buffer);
      const extracted = root.JEVPdf.extractPdfText(bytes);
      let amountList = root.JEVPdf.findAmounts(extracted);
      let signatureList = root.JEVPdf.findSignatures(extracted);
      fillList(amounts, amountList, "jev-pass");
      fillList(signatures, signatureList, "jev-glow");
      status.textContent = "";
      if (!viewerLive) return;
      return loadPdfJs().then(function (lib) {
        if (!viewerLive) return;
        return renderPages(lib, bytes, pages, amountList, signatureList).then(function (more) {
          const combined = extracted + "\n" + more;
          amountList = root.JEVPdf.findAmounts(combined);
          signatureList = root.JEVPdf.findSignatures(combined);
          fillList(amounts, amountList, "jev-pass");
          fillList(signatures, signatureList, "jev-glow");
          const layers = pages.querySelectorAll(".textLayer");
          for (let i = 0; i < layers.length; i++) paintLayer(layers[i], amountList, signatureList);
        });
      }).catch(function () {
        if (!viewerLive) return;
        fillList(amounts, amountList, "jev-pass");
        fillList(signatures, signatureList, "jev-glow");
      });
    }).catch(function (err) {
      if (!viewerLive || (err && err.name === "AbortError")) return;
      status.textContent = err && err.message ? err.message : "Could not read this PDF.";
    });
  }

  function pdfOn(state) {
    const id = root.JEV && root.JEV.FEATURES ? root.JEV.FEATURES.pdf : "pdf";
    return !!(root.JEV && root.JEV.featureOn && root.JEV.featureOn(state, id));
  }

  function boot() {
    const doc = root.document;
    if (!doc || !doc.getElementById) return;
    const app = doc.getElementById("jev-pdf-app");
    if (!app) return;
    const src = readSrc();
    const apply = function (state) {
      if (!pdfOn(state)) {
        viewerLive = false;
        stopViewer();
        renderEscape(app, src);
        return;
      }
      if (viewerLive) return;
      viewerLive = true;
      renderViewer(app, src);
    };
    if (root.JEV && typeof root.JEV.watchState === "function") {
      root.JEV.watchState(apply);
      return;
    }
    const ready = root.JEV && typeof root.JEV.loadState === "function"
      ? root.JEV.loadState()
      : Promise.resolve(null);
    Promise.resolve(ready).then(apply, function () { renderEscape(app, src); });
  }

  const api = { boot: boot, openInBrowser: openInBrowser };
  root.JEVPdfViewer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (root.document && root.document.getElementById && root.document.getElementById("jev-pdf-app")) boot();
})(typeof globalThis !== "undefined" ? globalThis : this);
