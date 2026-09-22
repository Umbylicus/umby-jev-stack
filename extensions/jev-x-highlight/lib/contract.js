(function (root) {
  const FEATURES = {
    highlight: "highlight",
    ads: "ads",
    focusDeclutter: "focusDeclutter",
    goldAccounts: "goldAccounts",
    redAccounts: "redAccounts",
    sessionCount: "sessionCount",
    readingList: "readingList",
    workHours: "workHours",
    highlightShortcut: "highlightShortcut",
    mail: "mail",
    draftCheck: "draftCheck",
    checkoutDomain: "checkoutDomain",
    stepsOnly: "stepsOnly",
    rejectCookies: "rejectCookies",
    decisionLine: "decisionLine",
    mustHaves: "mustHaves",
    pdf: "pdf",
    jobFit: "jobFit",
    helpCancel: "helpCancel",
    answerJump: "answerJump",
    duplicateSite: "duplicateSite",
    termsCard: "termsCard",
    proposalDiff: "proposalDiff",
    fillInfo: "fillInfo",
    fillBusiness: "fillBusiness"
  };

  const SITES = {
    x: "x",
    facebook: "facebook",
    instagram: "instagram",
    youtube: "youtube",
    reddit: "reddit",
    linkedin: "linkedin",
    gmail: "gmail",
    outlook: "outlook"
  };

  const SITE_LABELS = {
    x: "X",
    facebook: "Facebook",
    instagram: "Instagram",
    youtube: "YouTube",
    reddit: "Reddit",
    linkedin: "LinkedIn",
    gmail: "Gmail",
    outlook: "Outlook"
  };

  const FEATURE_LABELS = {
    highlight: "Highlight posts",
    ads: "Ads",
    focusDeclutter: "Focus and declutter",
    goldAccounts: "Always-gold accounts",
    redAccounts: "Always-red accounts",
    sessionCount: "Session count",
    readingList: "Reading list",
    workHours: "Work hours",
    highlightShortcut: "Highlight shortcut",
    mail: "Mail highlight",
    draftCheck: "Draft check",
    checkoutDomain: "Checkout domain",
    stepsOnly: "Steps only",
    rejectCookies: "Reject cookies",
    decisionLine: "Decision line",
    mustHaves: "Must-haves",
    pdf: "PDF amounts and signatures",
    jobFit: "Job fit",
    helpCancel: "Help me cancel",
    answerJump: "Answer jump",
    duplicateSite: "Duplicate site",
    termsCard: "Terms card",
    proposalDiff: "Proposal diff",
    fillInfo: "Fill my info",
    fillBusiness: "Fill my business"
  };

  const DEFAULTS = {
    enabled: false,
    sites: {
      x: true,
      facebook: false,
      instagram: false,
      youtube: false,
      reddit: false,
      linkedin: false,
      gmail: false,
      outlook: false
    },
    features: {
      highlight: true,
      ads: false,
      focusDeclutter: false,
      goldAccounts: false,
      redAccounts: false,
      sessionCount: false,
      readingList: false,
      workHours: false,
      highlightShortcut: true,
      mail: false,
      draftCheck: false,
      checkoutDomain: false,
      stepsOnly: false,
      rejectCookies: false,
      decisionLine: false,
      mustHaves: false,
      pdf: false,
      jobFit: false,
      helpCancel: false,
      answerJump: false,
      duplicateSite: false,
      termsCard: false,
      proposalDiff: false,
      fillInfo: false,
      fillBusiness: false
    },
    interests: [],
    notInterests: [],
    goldAccounts: [],
    redAccounts: [],
    readingList: [],
    workHours: {
      days: [1, 2, 3, 4, 5],
      start: "09:00",
      end: "17:00"
    },
    profile: { name: "", email: "", phone: "", address: "" },
    business: { name: "", phone: "", address: "" },
    mustHaveText: "",
    jobCanDo: "",
    apiKey: ""
  };

  const MSG = {
    COUNT: "jev-count",
    SAVE: "jev-save",
    READING_REMOVE: "jev-reading-remove",
    DUPLICATE: "jev-duplicate",
    DUPLICATE_IGNORE: "jev-duplicate-ignore",
    DUPLICATE_CLOSE: "jev-duplicate-close",
    PROPOSAL: "jev-proposal",
    PROPOSAL_DIFF: "jev-proposal-diff",
    PDF_BYPASS: "jev-pdf-bypass"
  };

  const TRACKING_PARAMS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "utm_name", "utm_reader", "utm_brand", "utm_cid", "utm_swu",
    "fbclid", "gclid", "gclsrc", "dclid", "gbraid", "wbraid", "msclkid", "twclid",
    "li_fat_id", "igshid", "igsh", "mc_cid", "mc_eid", "mkt_tok", "vero_id",
    "vero_conv", "oly_enc_id", "oly_anon_id", "_hsenc", "_hsmi", "hsctatracking",
    "yclid", "si", "ref_src", "ref_url", "ncid", "nr_email_referer", "mbextid",
    "scid", "cmpid", "_ga", "_gl"
  ];

  const api = {
    FEATURES,
    SITES,
    SITE_LABELS,
    FEATURE_LABELS,
    DEFAULTS,
    MSG,
    TRACKING_PARAMS
  };

  root.JEV = Object.assign(root.JEV || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
