const seen = new Map();
let enabled = false;
let scanning = false;
let watching = false;
const queue = [];
let active = 0;
const MAX_ACTIVE = 2;

chrome.storage.local.get("enabled", (stored) => {
  enabled = stored.enabled === true;
  if (enabled) watch();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.profile) return;
  clearMarks();
  if (enabled) scan();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "enabled") return;
  enabled = message.enabled === true;
  if (!enabled) clearMarks();
  else watch();
});

function watch() {
  if (watching) {
    scan();
    return;
  }
  watching = true;
  scan();
  const observer = new MutationObserver(() => scan());
  observer.observe(document.body, { childList: true, subtree: true });
  const onScroll = () => scan();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function scan() {
  if (!enabled || scanning) return;
  scanning = true;
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  for (const article of articles) {
    const post = readPost(article);
    if (!post.id || seen.has(post.id)) continue;
    if (!inView(article)) continue;
    seen.set(post.id, "pending");
    queue.push({ article, post });
  }
  scanning = false;
  drain();
}

function drain() {
  while (active < MAX_ACTIVE && queue.length) {
    const job = queue.shift();
    if (!job.article.isConnected) {
      seen.delete(job.post.id);
      continue;
    }
    active += 1;
    chrome.runtime.sendMessage({ type: "classify", post: job.post }, (result) => {
      active -= 1;
      if (chrome.runtime.lastError) {
        seen.delete(job.post.id);
        drain();
        return;
      }
      const mark = result?.mark;
      if (mark === "gold" || mark === "bad") {
        seen.set(job.post.id, mark);
        paint(job.article, mark);
      } else if (mark === "off") {
        seen.delete(job.post.id);
      } else {
        seen.set(job.post.id, "none");
      }
      drain();
    });
  }
}

function readPost(article) {
  const link = article.querySelector('a[href*="/status/"]');
  const id = link?.href?.match(/status\/(\d+)/)?.[1] || "";
  const social = article.querySelector('[data-testid="socialContext"]')?.innerText || "";
  const promoted = /promoted/i.test(social) || /^\s*ad\s*$/i.test(social.trim());
  return {
    id,
    author: (article.querySelector('[data-testid="User-Name"]')?.innerText || "").slice(0, 200),
    text: (article.querySelector('[data-testid="tweetText"]')?.innerText || "").slice(0, 2000),
    promoted
  };
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
  queue.length = 0;
}
