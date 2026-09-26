"use strict";

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "site");

const REDIRECTS = {
  "/plumbing": "/services.html",
  "/plumbing.html": "/services.html"
};

const EXTRA_STATUS = {
  "/gone.html": 404
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function sitemapUrls(origin) {
  return [
    "/",
    "/services.html",
    "/services/drains.html",
    "/services/water-heater.html",
    "/about.html",
    "/contact.html",
    "/blog/water-heater-noises.html",
    "/thanks.html",
    "/old-drains.html",
    "/gone.html"
  ].map((pathname) => new URL(pathname, origin).href);
}

function robotsTxt(origin) {
  return `User-agent: *\nAllow: /\nSitemap: ${new URL("/sitemap.xml", origin).href}\n`;
}

function sitemapIndex(origin) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${new URL("/sitemap-pages.xml", origin).href}</loc></sitemap>
</sitemapindex>
`;
}

function sitemapPages(origin) {
  const urls = sitemapUrls(origin)
    .map((loc) => `  <url><loc>${loc}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function send(res, status, type, body) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

export function fixtureRoot() {
  return SITE;
}

export function startFixtureServer(port = 0) {
  const server = http.createServer((req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const url = new URL(req.url || "/", origin);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

    if (REDIRECTS[url.pathname]) {
      res.writeHead(301, { Location: REDIRECTS[url.pathname] });
      res.end();
      return;
    }
    if (EXTRA_STATUS[url.pathname]) {
      send(res, EXTRA_STATUS[url.pathname], "text/plain; charset=utf-8", "Not found");
      return;
    }
    if (url.pathname === "/robots.txt") {
      send(res, 200, MIME[".txt"], robotsTxt(origin));
      return;
    }
    if (url.pathname === "/sitemap.xml") {
      send(res, 200, MIME[".xml"], sitemapIndex(origin));
      return;
    }
    if (url.pathname === "/sitemap-pages.xml") {
      send(res, 200, MIME[".xml"], sitemapPages(origin));
      return;
    }

    const file = path.normalize(path.join(SITE, pathname.replace(/^\/+/, "")));
    if (!file.startsWith(SITE)) {
      send(res, 403, "text/plain; charset=utf-8", "Forbidden");
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      send(res, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }
    const type = MIME[path.extname(file)] || "application/octet-stream";
    send(res, 200, type, fs.readFileSync(file));
  });

  return new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const url = `http://127.0.0.1:${address.port}/`;
      resolve({
        server,
        port: address.port,
        url,
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done, fail) => {
          server.close((error) => (error ? fail(error) : done()));
        })
      });
    });
    server.on("error", reject);
  });
}
