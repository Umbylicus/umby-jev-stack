(function (root) {
  const JEV = root.JEV;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function asPhrases(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const out = [];
    for (const item of value) {
      const text = String(item || "").trim();
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
    return out;
  }

  function asDays(value) {
    const days = Array.isArray(value) ? value : JEV.DEFAULTS.workHours.days;
    const out = [];
    for (const day of days) {
      const number = Number(day);
      if (number >= 0 && number <= 6 && !out.includes(number)) out.push(number);
    }
    return out;
  }

  function asClock(value, fallback) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
    if (!match) return fallback;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return fallback;
    return String(hour).padStart(2, "0") + ":" + match[2];
  }

  function mergeState(stored) {
    const state = clone(JEV.DEFAULTS);
    const source = stored || {};
    if (typeof source.enabled === "boolean") state.enabled = source.enabled;
    for (const key of Object.keys(state.sites)) {
      if (source.sites && typeof source.sites[key] === "boolean") state.sites[key] = source.sites[key];
    }
    for (const key of Object.keys(state.features)) {
      if (source.features && typeof source.features[key] === "boolean") state.features[key] = source.features[key];
    }
    state.interests = asPhrases(source.interests);
    state.notInterests = asPhrases(source.notInterests);
    state.goldAccounts = asPhrases(source.goldAccounts);
    state.redAccounts = asPhrases(source.redAccounts);
    state.readingList = Array.isArray(source.readingList)
      ? source.readingList.filter((item) => item && typeof item.url === "string").slice(0, 200)
      : [];
    state.workHours = {
      days: asDays(source.workHours && source.workHours.days),
      start: asClock(source.workHours && source.workHours.start, state.workHours.start),
      end: asClock(source.workHours && source.workHours.end, state.workHours.end)
    };
    state.profile = {
      name: String(source.profile && source.profile.name || ""),
      email: String(source.profile && source.profile.email || ""),
      phone: String(source.profile && source.profile.phone || ""),
      address: String(source.profile && source.profile.address || "")
    };
    state.business = {
      name: String(source.business && source.business.name || ""),
      phone: String(source.business && source.business.phone || ""),
      address: String(source.business && source.business.address || "")
    };
    state.mustHaveText = String(source.mustHaveText || "");
    state.jobCanDo = String(source.jobCanDo || "");
    state.apiKey = String(source.apiKey || "");
    return state;
  }

  function siteId(hostname) {
    const host = String(hostname || "").toLowerCase().replace(/^www\./, "");
    if (host === "x.com" || host === "twitter.com" || host.endsWith(".x.com") || host.endsWith(".twitter.com")) return "x";
    if (host === "facebook.com" || host.endsWith(".facebook.com")) return "facebook";
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
    if (host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com") || host.endsWith(".youtu.be")) return "youtube";
    if (host === "reddit.com" || host.endsWith(".reddit.com")) return "reddit";
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
    if (host === "mail.google.com") return "gmail";
    if (
      host === "outlook.live.com" ||
      host === "outlook.office.com" ||
      host === "outlook.office365.com" ||
      host === "outlook.cloud.microsoft" ||
      host.endsWith(".outlook.office.com") ||
      host.endsWith(".outlook.cloud.microsoft")
    ) return "outlook";
    return "";
  }

  function featureOn(state, id) {
    return !!(state && state.enabled && state.features && state.features[id]);
  }

  function siteOn(state, id) {
    return !!(state && state.enabled && id && state.sites && state.sites[id]);
  }

  function clockMinutes(value) {
    const parts = String(value || "00:00").split(":");
    return Number(parts[0]) * 60 + Number(parts[1] || 0);
  }

  function inWorkHours(state, date) {
    if (!state || !state.features || !state.features.workHours) return true;
    const when = date instanceof Date ? date : new Date();
    const days = (state.workHours && state.workHours.days) || [];
    if (!days.includes(when.getDay())) return false;
    const now = when.getHours() * 60 + when.getMinutes();
    const start = clockMinutes(state.workHours.start);
    const end = clockMinutes(state.workHours.end);
    if (start === end) return true;
    if (end < start) return now >= start || now < end;
    return now >= start && now < end;
  }

  function marksActive(state, date) {
    return featureOn(state, JEV.FEATURES.highlight) && inWorkHours(state, date);
  }

  function loadState() {
    return new Promise((resolve) => {
      const storage = root.chrome && root.chrome.storage && root.chrome.storage.local;
      if (!storage) {
        resolve(mergeState(null));
        return;
      }
      storage.get(null, (stored) => resolve(mergeState(stored)));
    });
  }

  function watchState(callback) {
    let last = null;
    const emit = () => {
      loadState().then((state) => {
        last = state;
        callback(state);
      });
    };
    emit();
    const changes = root.chrome && root.chrome.storage && root.chrome.storage.onChanged;
    if (!changes || !changes.addListener) return () => {};
    const listener = (change, area) => {
      if (area !== "local") return;
      emit();
    };
    changes.addListener(listener);
    return () => changes.removeListener(listener);
  }

  const api = {
    clone,
    mergeState,
    siteId,
    featureOn,
    siteOn,
    inWorkHours,
    marksActive,
    loadState,
    watchState
  };

  Object.assign(root.JEV, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
