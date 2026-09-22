(function (root) {
  "use strict";

  function trackingSet() {
    const list = root.JEV && root.JEV.TRACKING_PARAMS ? root.JEV.TRACKING_PARAMS : [];
    const set = new Set();
    for (let i = 0; i < list.length; i++) set.add(String(list[i]).toLowerCase());
    return set;
  }

  function normalizeUrl(href) {
    const raw = String(href == null ? "" : href).trim();
    if (!raw) return "";
    let url;
    try {
      url = new URL(raw);
    } catch (err) {
      return "";
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    let host = url.hostname.toLowerCase();
    if (host.indexOf("www.") === 0) host = host.slice(4);
    let port = "";
    if (url.port) port = ":" + url.port;
    let path = url.pathname || "/";
    if (path.length > 1 && path.charAt(path.length - 1) === "/") path = path.slice(0, -1);
    const tracking = trackingSet();
    const pairs = [];
    url.searchParams.forEach(function (value, key) {
      if (tracking.has(key.toLowerCase())) return;
      pairs.push([key, value]);
    });
    pairs.sort(function (a, b) {
      if (a[0] < b[0]) return -1;
      if (a[0] > b[0]) return 1;
      if (a[1] < b[1]) return -1;
      if (a[1] > b[1]) return 1;
      return 0;
    });
    let query = "";
    if (pairs.length) {
      const params = new URLSearchParams();
      for (let i = 0; i < pairs.length; i++) params.append(pairs[i][0], pairs[i][1]);
      query = "?" + params.toString();
    }
    return url.protocol + "//" + host + port + path + query + (url.hash || "");
  }

  function samePage(a, b) {
    const left = normalizeUrl(a);
    const right = normalizeUrl(b);
    return left !== "" && left === right;
  }

  function isPdfUrl(href) {
    const raw = String(href == null ? "" : href).trim();
    if (!raw) return false;
    try {
      const url = new URL(raw, "https://jev.invalid");
      return /\.pdf$/i.test(url.pathname);
    } catch (err) {
      return /\.pdf$/i.test(raw.split(/[?#]/)[0]);
    }
  }

  const api = { normalizeUrl: normalizeUrl, normalize: normalizeUrl, samePage: samePage, isPdfUrl: isPdfUrl };
  root.JEVUrl = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
