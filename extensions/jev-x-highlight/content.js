const seen = new Map();
let enabled = false;
let watching = false;
let rules = { interested: [], notInterested: [] };

chrome.storage.local.get(["enabled", "interested", "notInterested"], (stored) => {
  enabled = stored.enabled === true;
  rules = {
    interested: stored.interested || [],
    notInterested: stored.notInterested || []
  };
  if (enabled) watch();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.interested) rules.interested = changes.interested.newValue || [];
  if (changes.notInterested) rules.notInterested = changes.notInterested.newValue || [];
  if (changes.enabled) enabled = changes.enabled.newValue === true;
  clearMarks();
  if (enabled) watch();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "enabled") return;
  enabled = message.enabled === true;
  clearMarks();
  if (enabled) watch();
});

function watch() {
  if (watching) {
    scan();
    return;
  }
  watching = true;
  scan();
  new MutationObserver(() => scan()).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("scroll", () => scan(), { passive: true });
}

function scan() {
  if (!enabled) return;
  for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
    const post = readPost(article);
    if (!post.id || seen.has(post.id) || !inView(article)) continue;
    const mark = classify(post);
    seen.set(post.id, mark);
    paint(article, mark);
  }
}

function readPost(article) {
  const link = article.querySelector('a[href*="/status/"]');
  const id = link?.href?.match(/status\/(\d+)/)?.[1] || "";
  const social = article.querySelector('[data-testid="socialContext"]')?.innerText || "";
  const text = article.querySelector('[data-testid="tweetText"]')?.innerText || "";
  const promoted = /promoted/i.test(social) || /^\s*ad\s*$/i.test(social.trim());
  return { id: id || String(text).slice(0, 80), text, promoted };
}

function hits(text, ids) {
  const hay = text.toLowerCase();
  return ids.some((id) => {
    const category = JEV_CATEGORIES.find((item) => item.id === id);
    if (!category) return false;
    return category.words.some((word) => hay.includes(word));
  });
}

function classify(post) {
  const text = post.text || "";
  const spam = post.promoted || JEV_SPAM.some((word) => text.toLowerCase().includes(word));
  if (spam || hits(text, rules.notInterested)) return "bad";
  if (hits(text, rules.interested)) return "gold";
  return "none";
}

function inView(article) {
  const rect = article.getBoundingClientRect();
  return rect.bottom > -200 && rect.top < window.innerHeight + 400 && rect.height > 20;
}

function paint(article, mark) {
  article.classList.remove("jev-gold", "jev-bad");
  if (mark === "gold" || mark === "bad") article.classList.add("jev-" + mark);
}

function clearMarks() {
  document.querySelectorAll("article.jev-gold, article.jev-bad").forEach((article) => {
    article.classList.remove("jev-gold", "jev-bad");
  });
  seen.clear();
}
