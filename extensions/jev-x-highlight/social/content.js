(function (root) {
  "use strict";

  const SOCIAL = ["x", "facebook", "instagram", "youtube", "reddit", "linkedin"];
  const VISUAL = ["jev-gold", "jev-bad", "jev-faded", "jev-collapsed", "jev-hide", "jev-blur", "jev-anchor"];
  const revealed = new WeakSet();

  const POST_SELECTORS = {
    x: ['article[data-testid="tweet"]'],
    facebook: ['div[role="article"]'],
    instagram: ["article"],
    youtube: ["ytd-rich-item-renderer", "ytd-video-renderer", "ytd-grid-video-renderer"],
    reddit: ["shreddit-post", '[data-testid="post-container"]'],
    linkedin: [".feed-shared-update-v2", '[data-id^="urn:li:activity"]']
  };

  const CLUTTER_LABELS = {
    x: ["trends", "what's happening", "who to follow"],
    facebook: ["reels", "reels tray", "people you may know"],
    instagram: ["reels", "reels tray", "suggested for you"],
    youtube: ["shorts"],
    linkedin: ["linkedin news", "people you may know"],
    reddit: ["popular communities"]
  };

  const CLUTTER_SELECTORS = {
    x: [
      '[aria-label="Who to follow"]',
      '[aria-label="Trends"]',
      '[aria-label="What\'s happening"]',
      '[aria-label="What’s happening"]'
    ],
    facebook: ['[aria-label="Reels"]', '[aria-label="People you may know"]'],
    instagram: ['[aria-label="Reels"]', '[aria-label="Suggested for you"]'],
    youtube: ["ytd-reel-shelf-renderer"],
    linkedin: ['[aria-label="LinkedIn News"]', '[aria-label="People you may know"]'],
    reddit: ['[aria-label="Popular communities"]']
  };

  const LABEL_PATTERNS = {
    x: /^(promoted|ad)$/,
    facebook: /^(sponsored|promoted)$/,
    instagram: /^(sponsored|promoted)$/,
    youtube: /^(ad|sponsored|promoted)$/,
    reddit: /^promoted$/,
    linkedin: /^promoted$/
  };

  function ensureStack() {
    if (typeof require !== "function") return;
    try {
      if (!root.JEV) require("../lib/contract.js");
      if (!root.JEV || typeof root.JEV.siteId !== "function") require("../lib/runtime.js");
      if (!root.JEVMatch) root.JEVMatch = require("../lib/match.js");
    } catch (error) {
      /* content script loads these globals before this file */
    }
  }

  function attr(el, name) {
    if (!el || typeof el.getAttribute !== "function") return "";
    const value = el.getAttribute(name);
    return value == null ? "" : String(value);
  }

  function norm(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\u2018\u2019\u2032]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function ownText(el) {
    let out = "";
    for (const child of el.childNodes || []) {
      if (child.nodeType === 3) out += child.nodeValue || "";
    }
    return out.replace(/\s+/g, " ").trim();
  }

  function hash(value) {
    let h = 2166136261;
    const text = String(value || "");
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function deepElements(rootNode) {
    const out = [];
    function visit(node) {
      if (!node) return;
      if (node.nodeType === 1) out.push(node);
      const kids = node.children ? Array.from(node.children) : [];
      for (const child of kids) visit(child);
      if (node.shadowRoot) visit(node.shadowRoot);
    }
    if (rootNode && rootNode.nodeType === 9) visit(rootNode.documentElement);
    else visit(rootNode);
    return out;
  }

  let scanDepth = 0;
  let scanGeneration = 0;
  const shadowLists = new WeakMap();

  function scan(doc, fn) {
    const top = scanDepth === 0;
    scanDepth += 1;
    if (top) scanGeneration += 1;
    try {
      return fn();
    } finally {
      scanDepth -= 1;
    }
  }

  function rememberShadows(doc) {
    if (!doc || doc.nodeType !== 9) return [];
    const cached = shadowLists.get(doc);
    if (cached && cached.generation === scanGeneration) return cached.list;
    const list = [];
    function walk(node) {
      if (!node || typeof node.querySelectorAll !== "function") return;
      let hosts = [];
      try {
        hosts = node.querySelectorAll("*");
      } catch (error) {
        hosts = [];
      }
      for (const host of hosts) {
        if (!host.shadowRoot) continue;
        list.push(host.shadowRoot);
        walk(host.shadowRoot);
      }
    }
    walk(doc);
    shadowLists.set(doc, { generation: scanGeneration, list });
    return list;
  }

  function nodeInside(ancestor, node) {
    let current = node;
    let guard = 0;
    while (current && guard < 1000) {
      if (current === ancestor) return true;
      guard += 1;
      if (current.parentElement) {
        current = current.parentElement;
        continue;
      }
      const parent = current.parentNode;
      if (parent && parent.host) {
        current = parent.host;
        continue;
      }
      break;
    }
    return false;
  }

  function deepQueryAll(rootNode, selector) {
    const out = [];
    const seen = new Set();
    function take(node) {
      if (!node || typeof node.querySelectorAll !== "function") return;
      let found = [];
      try {
        found = node.querySelectorAll(selector);
      } catch (error) {
        return;
      }
      for (const el of found) {
        if (!seen.has(el)) {
          seen.add(el);
          out.push(el);
        }
      }
    }
    take(rootNode);
    const doc = rootNode && rootNode.nodeType === 9 ? rootNode : rootNode && rootNode.ownerDocument;
    for (const shadow of rememberShadows(doc)) {
      if (!shadow.host) continue;
      if (rootNode.nodeType === 9 || nodeInside(rootNode, shadow.host)) take(shadow);
    }
    return out;
  }

  function deepQuery(rootNode, selector) {
    return deepQueryAll(rootNode, selector)[0] || null;
  }

  function matchesSelector(el, selector) {
    if (!el || typeof el.matches !== "function") return false;
    try {
      return el.matches(selector);
    } catch (error) {
      return false;
    }
  }

  function isPostElement(el, site) {
    const selectors = POST_SELECTORS[site] || [];
    return selectors.some((selector) => matchesSelector(el, selector));
  }

  function insidePost(el, site) {
    let node = el;
    while (node && node.nodeType === 1) {
      if (isPostElement(node, site)) return true;
      node = node.parentElement;
    }
    return false;
  }

  function matchesComposer(el) {
    if (!el || el.nodeType !== 1) return false;
    const role = attr(el, "role").toLowerCase();
    const testid = attr(el, "data-testid").toLowerCase();
    const aria = attr(el, "aria-label").toLowerCase();
    const id = (el.id || "").toLowerCase();
    const cls = (typeof el.className === "string" ? el.className : "").toLowerCase();
    const blob = testid + " " + id + " " + cls;
    if (role === "textbox") return true;
    if (el.hasAttribute && el.hasAttribute("contenteditable") && attr(el, "contenteditable").toLowerCase() !== "false") return true;
    if (/tweettextarea|composer|share-?box|share_box|tweet-?box|draft-editor|ql-editor/.test(blob)) return true;
    if (/what'?s on your mind|what'?s happening|create a post|start a post|write something|tweet text|share an update|add a comment/.test(aria)) return true;
    return false;
  }

  function matchesMessageUi(el) {
    const testid = attr(el, "data-testid").toLowerCase();
    const aria = norm(attr(el, "aria-label"));
    const id = (el.id || "").toLowerCase();
    const cls = (typeof el.className === "string" ? el.className : "").toLowerCase();
    const blob = testid + " " + id + " " + cls;
    if (testid === "dmdrawer" || /dm-?drawer|messenger-drawer|message-drawer/.test(blob)) return true;
    if (/^(messages|messenger|direct messages|chats|message requests)$/.test(aria)) return true;
    if (attr(el, "role").toLowerCase() === "dialog" && /message|messenger/.test(aria)) return true;
    if (/(messages|messenger)/.test(blob) && /(drawer|inbox|thread|panel|dock|overlay)/.test(blob)) return true;
    return false;
  }

  function matchesAccountMenu(el) {
    const role = attr(el, "role").toLowerCase();
    const testid = attr(el, "data-testid").toLowerCase();
    const aria = norm(attr(el, "aria-label"));
    const id = (el.id || "").toLowerCase();
    if (role === "menu") return true;
    if (/sidenav_accountswitcher|account-switcher|account_switcher|profile-menu|user-menu|usermenu/.test(testid + " " + id)) return true;
    if (aria === "account menu" || aria === "profile menu" || aria === "account" || aria.indexOf("account menu") >= 0 || aria.indexOf("profile menu") >= 0) return true;
    return false;
  }

  function matchesChrome(el) {
    const role = attr(el, "role").toLowerCase();
    const tag = el.tagName;
    if (role === "banner" || role === "navigation") return true;
    if (tag === "NAV" || tag === "YTD-MASTHEAD") return true;
    if (el.id === "masthead" || el.id === "global-nav" || el.id === "navbar") return true;
    const testid = attr(el, "data-testid").toLowerCase();
    if (testid === "primarynav" || testid === "sidenav" || testid === "topbar" || testid === "app-header") return true;
    if (tag === "HEADER") {
      const aria = attr(el, "aria-label").toLowerCase();
      if (/primary|global|site navigation|main navigation|banner/.test(aria)) return true;
      if (typeof el.querySelector === "function" && el.querySelector('nav, [role="navigation"]')) return true;
    }
    return false;
  }

  function isProtectedElement(el) {
    return !!(el && el.nodeType === 1 && (matchesComposer(el) || matchesMessageUi(el) || matchesAccountMenu(el) || matchesChrome(el)));
  }

  function hasProtectedDescendant(el) {
    if (!el) return false;
    const kids = el.children ? Array.from(el.children) : [];
    for (const child of kids) {
      if (isProtectedElement(child) || hasProtectedDescendant(child)) return true;
    }
    if (el.shadowRoot && hasProtectedDescendant(el.shadowRoot)) return true;
    return false;
  }

  function isProtected(el) {
    if (!el || el.nodeType !== 1) return false;
    let node = el;
    while (node && node.nodeType === 1) {
      if (isProtectedElement(node)) return true;
      node = node.parentElement;
    }
    return hasProtectedDescendant(el);
  }

  function textOutside(rootNode, excluded) {
    const skip = new Set(excluded || []);
    let out = "";
    function walk(node) {
      if (!node) return;
      if (node.nodeType === 1 && skip.has(node)) return;
      if (node.nodeType === 3) {
        out += node.nodeValue || "";
        return;
      }
      for (const child of node.childNodes || []) walk(child);
      if (node.shadowRoot) walk(node.shadowRoot);
    }
    walk(rootNode);
    return out;
  }

  function placeholderOnly(text) {
    return /^(what'?s on your mind\??|what'?s happening\??|start a post|create a post|write something|tweet text|share an update|add a comment)$/.test(norm(text));
  }

  function isOnlyComposer(el) {
    if (matchesComposer(el)) return true;
    const composers = deepElements(el).filter(matchesComposer);
    if (!composers.length) return false;
    const text = norm(textOutside(el, composers));
    return !text || placeholderOnly(text);
  }

  function pageHref() {
    try {
      if (root.location && root.location.href) return String(root.location.href);
    } catch (error) {
      return "";
    }
    return "";
  }

  function absolutize(href, hostname) {
    const value = String(href || "").trim();
    if (!value || value.startsWith("javascript:") || value.startsWith("#")) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("//")) return "https:" + value;
    const host = String(hostname || "").replace(/^www\./, "");
    if (!host) return value;
    if (value.startsWith("/")) return "https://" + host + value;
    return "https://" + host + "/" + value;
  }

  function fallbackId(site, author, text) {
    return site + ":" + hash(site + "\n" + author + "\n" + text);
  }

  function linkHref(el, regex, nestedSelector) {
    const nested = nestedSelector ? deepQueryAll(el, nestedSelector) : [];
    let nestedHit = "";
    for (const link of deepQueryAll(el, "a")) {
      const match = regex.exec(attr(link, "href"));
      if (!match) continue;
      if (nested.some((node) => node.contains(link))) {
        if (!nestedHit) nestedHit = match[1];
        continue;
      }
      return match[1];
    }
    return nestedHit;
  }

  function bestUrl(el, site, hostname) {
    const links = deepQueryAll(el, "a");
    let fallback = "";
    for (const link of links) {
      const href = attr(link, "href");
      const absolute = absolutize(href, hostname);
      if (!absolute) continue;
      if (!fallback) fallback = absolute;
      if (site === "x" && /\/status\/\d+/.test(href)) return absolute;
      if (site === "youtube" && (/[?&]v=/.test(href) || /\/shorts\//.test(href))) return absolute;
      if (site === "reddit" && /\/comments\//.test(href)) return absolute;
      if (site === "linkedin" && /(activity|\/posts\/)/.test(href)) return absolute;
      if ((site === "facebook" || site === "instagram") && /\/(posts|permalink|reel|p)\//.test(href)) return absolute;
    }
    return fallback || pageHref();
  }

  function postTitle(site, el, text) {
    if (site === "youtube") return normKeep(text);
    const heading = deepQuery(el, 'h1, h2, h3, [role="heading"]');
    if (heading) {
      const value = normKeep(heading.textContent);
      if (value && value.length <= 180 && !/^(sponsored|promoted|ad)$/i.test(value)) return value;
    }
    const line = normKeep(text);
    return line.length > 180 ? line.slice(0, 180) : line;
  }

  function normKeep(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isShortAdText(value) {
    return /^(ad|sponsored|promoted)(?:$|[·•|:-].*)$/.test(norm(value));
  }

  function hasOwnLabel(rootNode, regex, ignore) {
    for (const node of deepElements(rootNode)) {
      if (ignore && ignore(node)) continue;
      const text = norm(ownText(node));
      if (!text || text.length > 24) continue;
      if (regex.test(text)) return true;
    }
    return false;
  }

  function bodyIgnored(node) {
    if (!node || typeof node.closest !== "function") return false;
    return !!(
      node.closest('[data-testid="tweetText"]') ||
      node.closest("#video-title") ||
      node.closest("#description, #description-text, #description-inline-expander, #content-text, ytd-text-inline-expander, ytd-expander")
    );
  }

  function readX(el) {
    const textEl = deepQuery(el, '[data-testid="tweetText"]');
    const authorEl = deepQuery(el, '[data-testid="User-Name"]');
    const context = deepQuery(el, '[data-testid="socialContext"]');
    const contextText = context ? context.textContent : "";
    const text = textEl ? textEl.textContent : "";
    const author = authorEl ? authorEl.textContent : "";
    const id = linkHref(el, /\/status\/(\d+)/, 'article[data-testid="tweet"]') || fallbackId("x", author, text);
    const ad = /promoted/i.test(contextText) || /^\s*ad\s*$/i.test(String(contextText || ""));
    return { el, id, text, author, ad };
  }

  function readFacebook(el) {
    const heading = deepQuery(el, 'h1, h2, h3, h4, [role="heading"]');
    const authorLink = heading ? deepQuery(heading, "a") : null;
    const excluded = deepElements(el).filter(matchesComposer);
    if (heading) excluded.push(heading);
    for (const nested of deepQueryAll(el, 'div[role="article"]')) excluded.push(nested);
    const text = textOutside(el, excluded).trim();
    const author = authorLink ? authorLink.textContent.trim() : "";
    const ad = hasOwnLabel(el, LABEL_PATTERNS.facebook, bodyIgnored);
    return { el, id: fallbackId("facebook", author, text), text, author, ad };
  }

  function readInstagram(el) {
    const header = deepQuery(el, "header");
    const authorLink = header ? deepQuery(header, "a") : null;
    const excluded = deepElements(el).filter(matchesComposer);
    if (header) excluded.push(header);
    let text = textOutside(el, excluded).trim();
    if (!text && header) text = textOutside(header, authorLink ? [authorLink] : []).trim();
    const author = authorLink ? authorLink.textContent.trim() : "";
    const ad = hasOwnLabel(el, LABEL_PATTERNS.instagram, bodyIgnored);
    const shortcode = linkHref(el, /\/p\/([^/?#]+)/, "article") || linkHref(el, /\/reel\/([^/?#]+)/, "article");
    return { el, id: shortcode ? "ig:" + shortcode : fallbackId("instagram", author, text), text, author, ad };
  }

  function readYouTube(el) {
    const title = deepQuery(el, "a#video-title, #video-title");
    const text = title ? title.textContent : "";
    const channel = deepQuery(el, "ytd-channel-name, #channel-name");
    const author = channel ? channel.textContent.trim() : "";
    const video = linkHref(el, /[?&]v=([A-Za-z0-9_-]{6,})/, null) || linkHref(el, /\/shorts\/([A-Za-z0-9_-]{6,})/, null);
    const badges = deepQueryAll(el, "ytd-badge-supported-renderer, ytd-ad-slot-renderer, badge-shape, .badge, .ytd-badge-supported-renderer");
    let ad = badges.some((badge) => [ownText(badge), attr(badge, "aria-label"), badge.textContent].some(isShortAdText));
    if (!ad) {
      ad = hasOwnLabel(el, LABEL_PATTERNS.youtube, (node) => bodyIgnored(node) || node === title || (title && title.contains(node)));
    }
    return { el, id: video ? "yt:" + video : fallbackId("youtube", author, text), text, author, ad };
  }

  function readReddit(el) {
    const authorLink = deepQuery(el, 'a[href*="/user/"]');
    const slot = deepQuery(el, '[slot="authorName"]');
    const author = (authorLink && authorLink.textContent.trim()) || (slot && slot.textContent.trim()) || attr(el, "author") || "";
    const title = deepQuery(el, '[slot="title"], [data-testid="post-title"], h1, h2, h3');
    const body = deepQuery(el, '[slot="text-body"], [data-testid="post-content"]');
    let text = "";
    if (title) text += title.textContent || "";
    if (body && body !== title) text += " " + (body.textContent || "");
    if (!normKeep(text)) text = textOutside(el, deepElements(el).filter(matchesComposer));
    const ad = el.tagName === "SHREDDIT-AD" || (el.hasAttribute && el.hasAttribute("is-ad")) || hasOwnLabel(el, LABEL_PATTERNS.reddit, bodyIgnored);
    const postId = attr(el, "id") || linkHref(el, /\/comments\/([^/?#]+)/, "shreddit-post") || fallbackId("reddit", author, text);
    return { el, id: String(postId).indexOf("reddit:") === 0 ? postId : "reddit:" + postId, text: text.trim(), author, ad };
  }

  function readLinkedIn(el) {
    const authorEl = deepQuery(el, ".update-components-actor__name");
    const author = authorEl ? authorEl.textContent.trim() : "";
    const body = deepQuery(el, '.update-components-text, .feed-shared-update-v2__description, [data-testid="post-text"]');
    const excluded = deepElements(el).filter(matchesComposer);
    if (authorEl) excluded.push(authorEl);
    const text = (body ? body.textContent : textOutside(el, excluded)).trim();
    const ad = hasOwnLabel(el, LABEL_PATTERNS.linkedin, bodyIgnored);
    const id = attr(el, "data-id") || fallbackId("linkedin", author, text);
    return { el, id, text, author, ad };
  }

  const READERS = {
    x: readX,
    facebook: readFacebook,
    instagram: readInstagram,
    youtube: readYouTube,
    reddit: readReddit,
    linkedin: readLinkedIn
  };

  function collectPosts(document, siteId) {
    const selectors = POST_SELECTORS[siteId];
    const read = READERS[siteId];
    if (!document || !selectors || !read) return [];
    const seen = new Set();
    const posts = [];
    for (const selector of selectors) {
      for (const el of deepQueryAll(document, selector)) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (el.tagName === "YTD-REEL-SHELF-RENDERER") continue;
        if (isOnlyComposer(el)) continue;
        const post = read(el);
        if (post && post.el) posts.push(post);
      }
    }
    return posts.filter((post) => {
      return !posts.some((other) => other !== post && other.id && other.id === post.id && other.el.contains(post.el));
    });
  }

  function findPosts(document, siteId) {
    return scan(document, () => collectPosts(document, siteId));
  }

  function isAdIframe(el) {
    if (!el || el.tagName !== "IFRAME") return false;
    const src = (attr(el, "src") + " " + attr(el, "data-src")).toLowerCase();
    return src.indexOf("doubleclick") >= 0 || src.indexOf("googlesyndication") >= 0 || src.indexOf("amazon-adsystem") >= 0;
  }

  function lockedChrome(el) {
    if (!el || el.nodeType !== 1) return false;
    return el.id === "movie_player" || el.tagName === "YTD-MASTHEAD";
  }

  function containsLockedChrome(el) {
    if (!el || typeof el.querySelector !== "function") return false;
    return !!(el.querySelector("#movie_player") || el.querySelector("ytd-masthead"));
  }

  function cardForLabel(labelEl, site) {
    let chosen = labelEl;
    let node = labelEl;
    while (node && node.parentElement) {
      const parent = node.parentElement;
      if (!parent || parent.nodeType !== 1) break;
      if (parent.tagName === "BODY" || parent.tagName === "HTML" || parent.tagName === "DOCUMENT") break;
      if (attr(parent, "role").toLowerCase() === "main") break;
      if (typeof parent.querySelector === "function" && parent.querySelector('[role="main"]')) break;
      if (isProtectedElement(parent) && !isPostElement(parent, site)) break;
      chosen = parent;
      if (isPostElement(parent, site)) return parent;
      const tag = parent.tagName;
      const role = attr(parent, "role").toLowerCase();
      if (tag === "ARTICLE" || tag === "ASIDE" || tag === "SECTION" || role === "complementary" || role === "article") return parent;
      node = parent;
    }
    return chosen;
  }

  function collectAds(document, siteId) {
    if (!document || !POST_SELECTORS[siteId]) return [];
    const posts = collectPosts(document, siteId);
    const seen = new Set();
    const candidates = [];
    function push(el) {
      if (!el || el.nodeType !== 1 || seen.has(el)) return;
      if (el.tagName === "BODY" || el.tagName === "HTML" || el.tagName === "DOCUMENT") return;
      if (typeof el.querySelector === "function" && el.querySelector('[role="main"]')) return;
      if (el.id === "movie_player" || el.tagName === "YTD-MASTHEAD") return;
      seen.add(el);
      candidates.push(el);
    }
    for (const iframe of deepQueryAll(document, "iframe")) {
      if (isAdIframe(iframe)) push(iframe);
    }
    for (const el of deepQueryAll(document, "shreddit-ad, [is-ad], ytd-ad-slot-renderer")) push(el);
    for (const post of posts) {
      if (post.ad) push(post.el);
    }
    const pattern = LABEL_PATTERNS[siteId];
    if (pattern) {
      const scope = document.documentElement || document.body || document;
      for (const el of deepElements(scope)) {
        const text = norm(ownText(el));
        if (!text || text.length > 24 || !pattern.test(text)) continue;
        if (bodyIgnored(el)) continue;
        if (siteId === "x" && attr(el, "data-testid") !== "socialContext" && !(el.closest && el.closest('[data-testid="socialContext"]'))) continue;
        push(cardForLabel(el, siteId));
      }
    }
    const results = [];
    for (const el of candidates) {
      if (!el.parentNode && el.tagName !== "IFRAME") continue;
      if (isProtected(el) || lockedChrome(el)) continue;
      const containsReal = posts.some((post) => !post.ad && post.el !== el && el.contains(post.el));
      const action = containsReal || containsLockedChrome(el) ? "blur" : "remove";
      results.push({ el, action });
    }
    return results;
  }

  function findAds(document, siteId) {
    return scan(document, () => collectAds(document, siteId));
  }

  function labelMatch(raw, labels) {
    const value = norm(raw);
    if (!value || value.length > 80) return false;
    return labels.some((label) => {
      if (value === label) return true;
      if (value.indexOf(label) !== 0) return false;
      const rest = value.slice(label.length).trim();
      return !rest || (rest.length <= 20 && /^(for you|tray|see all|show more|·|•|-)$/.test(rest));
    });
  }

  function closestClutterSelector(el, site) {
    const selectors = CLUTTER_SELECTORS[site] || [];
    let node = el;
    while (node && node.nodeType === 1) {
      if (selectors.some((selector) => matchesSelector(node, selector))) return node;
      node = node.parentElement;
    }
    return null;
  }

  function isClimbBoundary(el, site) {
    if (!el || el.nodeType !== 1) return true;
    const tag = el.tagName;
    if (tag === "BODY" || tag === "HTML" || tag === "DOCUMENT") return true;
    if (attr(el, "role").toLowerCase() === "main") return true;
    if (typeof el.querySelector === "function" && el.querySelector('[role="main"]')) return true;
    return isPostElement(el, site);
  }

  function isColumnShell(el) {
    const testid = attr(el, "data-testid").toLowerCase();
    const id = (el.id || "").toLowerCase();
    if (id === "sidebar" || id === "related") return true;
    return /sidebar|primarycolumn|secondarycolumn/.test(testid) && !/who-to-follow|trend|reels|suggestion|communities|shorts/.test(testid);
  }

  function isModule(el) {
    const tag = el.tagName;
    const role = attr(el, "role").toLowerCase();
    return tag === "ASIDE" || tag === "SECTION" || role === "complementary" || role === "region" || /SHELF-RENDERER$/.test(tag);
  }

  function containsOutsidePost(parent, node, site) {
    const selectors = POST_SELECTORS[site] || [];
    return selectors.some((selector) => {
      return deepQueryAll(parent, selector).some((post) => !node.contains(post));
    });
  }

  function isHeadingElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (/^H[1-6]$/.test(el.tagName)) return true;
    return attr(el, "role").toLowerCase() === "heading";
  }

  function hasOtherHeading(parent, heading) {
    return deepQueryAll(parent, 'h1, h2, h3, h4, h5, h6, [role="heading"]').some((other) => other !== heading);
  }

  function sectionForHeading(heading, site) {
    const known = closestClutterSelector(heading, site);
    if (known) return known;
    let chosen = heading;
    let node = heading;
    while (node && node.parentElement) {
      const parent = node.parentElement;
      if (isClimbBoundary(parent, site) || isColumnShell(parent)) break;
      if (containsOutsidePost(parent, node, site) || hasOtherHeading(parent, heading)) break;
      chosen = parent;
      node = parent;
      if (isModule(chosen)) break;
    }
    return chosen;
  }

  function collectClutter(document, siteId) {
    const labels = CLUTTER_LABELS[siteId];
    if (!document || !labels) return [];
    const found = [];
    const seen = new Set();
    function push(el) {
      if (!el || el.nodeType !== 1 || seen.has(el)) return;
      if (el.tagName === "BODY" || el.tagName === "HTML" || el.tagName === "DOCUMENT") return;
      if (isPostElement(el, siteId) || insidePost(el, siteId)) return;
      if ((POST_SELECTORS[siteId] || []).some((selector) => deepQueryAll(el, selector).length > 0)) return;
      if (attr(el, "role").toLowerCase() === "main") return;
      if (typeof el.querySelector === "function" && el.querySelector('[role="main"]')) return;
      if (isProtected(el)) return;
      if (el.id === "movie_player" || el.tagName === "YTD-MASTHEAD") return;
      seen.add(el);
      found.push(el);
    }
    function childHeading(el, origin) {
      if (!el || el === origin || el.nodeType !== 1) return null;
      if (isHeadingElement(el)) return el;
      if (typeof el.querySelector !== "function") return null;
      const nested = el.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
      return nested && nested !== origin ? nested : null;
    }
    function pushHeadingRange(heading) {
      const parent = heading.parentElement;
      if (!parent || !parent.children) return false;
      const children = Array.from(parent.children);
      const start = children.indexOf(heading);
      if (start < 0) return false;
      const mine = norm(heading.textContent);
      let different = false;
      for (let i = start + 1; i < children.length; i++) {
        const foundHeading = childHeading(children[i], heading);
        if (!foundHeading) continue;
        if (norm(foundHeading.textContent) !== mine) different = true;
        if (different) break;
      }
      if (!different) return false;
      for (let i = start; i < children.length; i++) {
        const child = children[i];
        if (i > start && childHeading(child, heading)) break;
        if (insidePost(child, siteId) || isProtected(child)) continue;
        push(child);
      }
      return true;
    }
    for (const selector of CLUTTER_SELECTORS[siteId] || []) {
      for (const el of deepQueryAll(document, selector)) push(el);
    }
    for (const heading of deepQueryAll(document, 'h1, h2, h3, h4, h5, [role="heading"]')) {
      if (!labelMatch(heading.textContent, labels)) continue;
      if (insidePost(heading, siteId)) continue;
      if (pushHeadingRange(heading)) continue;
      push(sectionForHeading(heading, siteId));
    }
    return found.filter((el) => !found.some((other) => other !== el && el.contains(other)));
  }

  function findClutter(document, siteId) {
    return scan(document, () => collectClutter(document, siteId));
  }

  function clear(document) {
    if (!document || typeof document.querySelectorAll !== "function") return;
    const marked = document.querySelectorAll(".jev-gold, .jev-bad, .jev-faded, .jev-collapsed, .jev-hide, .jev-blur, .jev-anchor");
    for (const el of marked) {
      if (el.classList) el.classList.remove.apply(el.classList, VISUAL);
    }
    const extras = Array.from(document.querySelectorAll(".jev-x, .jev-show, .jev-save"));
    for (const el of extras) el.remove();
  }

  function silence(event) {
    if (!event) return;
    if (typeof event.preventDefault === "function") event.preventDefault();
    if (typeof event.stopPropagation === "function") event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
  }

  function send(message) {
    try {
      const runtime = root.chrome && root.chrome.runtime;
      if (runtime && typeof runtime.sendMessage === "function") runtime.sendMessage(message);
    } catch (error) {
      /* a missing listener is not a scan failure */
    }
  }

  function addControl(el, className, label, onClick) {
    const doc = el.ownerDocument || root.document;
    const button = doc.createElement("button");
    button.className = className;
    button.setAttribute("type", "button");
    button.textContent = label;
    button.addEventListener("click", (event) => {
      silence(event);
      onClick();
    });
    el.appendChild(button);
    return button;
  }

  function addBadge(el) {
    const doc = el.ownerDocument || root.document;
    const badge = doc.createElement("span");
    badge.className = "jev-x";
    badge.textContent = "X";
    badge.setAttribute("aria-hidden", "true");
    el.appendChild(badge);
  }

  function featureOn(state, id) {
    const jev = root.JEV;
    if (!jev || typeof jev.featureOn !== "function") return false;
    try {
      return !!jev.featureOn(state, id);
    } catch (error) {
      return false;
    }
  }

  function marksActive(state, now) {
    const jev = root.JEV;
    if (!jev || typeof jev.marksActive !== "function") return false;
    try {
      return !!jev.marksActive(state, now);
    } catch (error) {
      return false;
    }
  }

  function classifyPost(post, state) {
    const matcher = root.JEVMatch;
    if (!matcher || typeof matcher.classify !== "function") return "none";
    try {
      return matcher.classify({ text: post.text, author: post.author, ad: post.ad }, state) || "none";
    } catch (error) {
      return "none";
    }
  }

  function applyAds(document, site) {
    const ads = findAds(document, site);
    const removals = ads.filter((ad) => ad.action === "remove");
    removals.sort((a, b) => depth(b) - depth(a));
    for (const ad of removals) {
      if (!ad.el || !ad.el.parentNode || isProtected(ad.el) || lockedChrome(ad.el)) continue;
      if (containsLockedChrome(ad.el)) {
        ad.el.classList.add("jev-blur");
        continue;
      }
      ad.el.remove();
    }
    for (const ad of ads) {
      if (ad.action !== "blur" || !ad.el || !ad.el.parentNode) continue;
      if (isProtected(ad.el) || lockedChrome(ad.el)) continue;
      ad.el.classList.add("jev-blur");
    }
  }

  function depth(el) {
    let count = 0;
    let node = el;
    while (node && node.parentNode) {
      count += 1;
      node = node.parentNode;
    }
    return count;
  }

  function paintPosts(posts, state, now, site, hostname) {
    const focus = featureOn(state, "focusDeclutter");
    const marks = marksActive(state, now);
    const reading = featureOn(state, "readingList");
    const countOn = marks && featureOn(state, "sessionCount");
    const counted = new Set();
    const typeCount = root.JEV && root.JEV.MSG && root.JEV.MSG.COUNT;
    const typeSave = root.JEV && root.JEV.MSG && root.JEV.MSG.SAVE;
    for (const post of posts) {
      if (!post.el || !post.el.parentNode) continue;
      const mark = classifyPost(post, state);
      if (focus) {
        if (mark === "bad" && !revealed.has(post.el)) {
          post.el.classList.add("jev-collapsed");
          addControl(post.el, "jev-show", "Show", () => {
            revealed.add(post.el);
            post.el.classList.remove("jev-collapsed");
            const button = post.el.querySelector(".jev-show");
            if (button) button.remove();
          });
        } else if (mark !== "gold" && mark !== "bad") post.el.classList.add("jev-faded");
      }
      if (marks && mark === "gold") post.el.classList.add("jev-gold", "jev-anchor");
      if (marks && mark === "bad") {
        post.el.classList.add("jev-bad", "jev-anchor");
        addBadge(post.el);
      }
      if (mark === "gold" && reading && typeSave) {
        post.el.classList.add("jev-anchor");
        addControl(post.el, "jev-save", "Save", () => {
          send({
            type: typeSave,
            item: {
              id: post.id,
              url: bestUrl(post.el, site, hostname) || pageHref(),
              title: postTitle(site, post.el, post.text),
              text: post.text,
              site
            }
          });
        });
      }
      if (countOn && typeCount && (mark === "gold" || mark === "bad") && post.id && !counted.has(post.id)) {
        counted.add(post.id);
        send({ type: typeCount, mark, id: post.id });
      }
    }
  }

  function apply(document, state, now, hostname) {
    ensureStack();
    clear(document);
    const jev = root.JEV;
    if (!document || !jev || typeof jev.siteId !== "function" || typeof jev.siteOn !== "function") return;
    let site = "";
    try {
      site = jev.siteId(hostname) || "";
    } catch (error) {
      site = "";
    }
    if (SOCIAL.indexOf(site) < 0 || !jev.siteOn(state, site)) return;
    scan(document, () => {
      if (featureOn(state, "ads")) applyAds(document, site);
      if (featureOn(state, "focusDeclutter")) {
        for (const el of findClutter(document, site)) {
          if (el && el.parentNode && !isProtected(el)) el.classList.add("jev-hide");
        }
      }
      const posts = findPosts(document, site);
      if (!posts.length) return;
      paintPosts(posts, state, now, site, hostname);
    });
  }

  function boot(page) {
    ensureStack();
    const jev = root.JEV;
    if (!page || !jev || typeof jev.watchState !== "function") return;
    let state = null;
    let frame = 0;
    let observer = null;
    const run = () => {
      frame = 0;
      const host = (root.location && root.location.hostname) || "";
      if (observer) observer.disconnect();
      try {
        api.apply(page, state, new Date(), host);
      } finally {
        if (observer && page.documentElement) {
          observer.observe(page.documentElement, { childList: true, subtree: true });
        }
      }
    };
    const schedule = () => {
      if (frame) return;
      if (typeof root.requestAnimationFrame === "function") frame = root.requestAnimationFrame(run) || 1;
      else if (typeof root.setTimeout === "function") frame = root.setTimeout(run, 16);
      else run();
    };
    jev.watchState((next) => {
      state = next;
      schedule();
    });
    if (typeof root.MutationObserver === "function" && page.documentElement) {
      observer = new root.MutationObserver(() => schedule());
      observer.observe(page.documentElement, { childList: true, subtree: true });
    }
  }

  const api = { findPosts, findAds, findClutter, isProtected, apply, clear };
  root.JEVSocial = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  const page = typeof document !== "undefined" ? document : null;
  if (page && root.chrome && root.chrome.runtime && root.chrome.runtime.id) boot(page);
})(typeof globalThis !== "undefined" ? globalThis : this);
