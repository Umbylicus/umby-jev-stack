(function (root) {
  const PAGE = {
    draftCheck: { key: "promises_price_date_or_refund", instructions: "Does this draft promise a price, a date, or a refund?", yes: "It promises a price, a date, or a refund.", no: "It does not." },
    checkoutDomain: { key: "brand_domain_mismatch", instructions: "Does the brand in this pay page fail to match the site domain?", yes: "The brand and domain do not match.", no: "They match, or this is not a pay page." },
    decisionLine: { key: "has_decision", instructions: "Does this text contain a decision, an owner, and a date or the lack of one?", yes: "A decision is present.", no: "No decision is present." },
    mustHaves: { key: "spec_fails_requirement", instructions: "Does a product spec on this page fail a stated requirement such as weight or voltage?", yes: "A spec fails.", no: "No spec fails." },
    jobFit: { key: "job_misses_skill", instructions: "Does this job post require something the reader did not list as a skill they can do?", yes: "A requirement is missed.", no: "The requirements match or there is no job post." },
    termsCard: { key: "terms_have_key_clauses", instructions: "Does this terms or privacy page discuss auto-renew, cancellation, arbitration, or selling data?", yes: "At least one of those clauses is present.", no: "None of those clauses are present." },
    proposalDiff: { key: "proposal_price_term_or_liability", instructions: "Does this proposal or contract state a price, a term, or a liability clause?", yes: "It states one of those.", no: "It does not." },
    answerJump: { key: "article_has_sections", instructions: "Is this an article with sections that could answer a question?", yes: "It is an article.", no: "It is not an article." },
    stepsOnly: { key: "is_tutorial", instructions: "Is this page a tutorial or how-to with numbered steps?", yes: "It is a tutorial.", no: "It is not." },
    rejectCookies: { key: "has_cookie_reject", instructions: "Does this page show a reject-cookies or essential-only button?", yes: "That button is present.", no: "It is not." },
    helpCancel: { key: "is_cancel_flow", instructions: "Is this a subscription or account cancellation flow?", yes: "It is a cancel flow.", no: "It is not." },
    pdf: { key: "has_amount_or_signature", instructions: "Does this document contain a money amount or a signature line?", yes: "It does.", no: "It does not." },
    duplicateSite: { key: "same_page_opened", instructions: "Is this text a normal web page rather than an email?", yes: "It is a web page.", no: "It is email." },
    fillInfo: { key: "has_personal_form", instructions: "Does this page contain a form that asks for a person's name, email, phone, or address?", yes: "It does.", no: "It does not." },
    fillBusiness: { key: "has_business_form", instructions: "Does this page contain a form that asks for a business name, phone, or address?", yes: "It does.", no: "It does not." }
  };

  function item(feature, id, content, specs) {
    return new Promise(function (resolve) {
      const runtime = root.chrome && root.chrome.runtime;
      if (!runtime || typeof runtime.sendMessage !== "function") {
        resolve(null);
        return;
      }
      let settled = false;
      const finish = function (value) {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const timer = setTimeout(function () { finish(null); }, 15000);
      try {
        runtime.sendMessage({
          type: (root.JEV && root.JEV.MSG && root.JEV.MSG.ASK) || "jev-ask",
          feature: feature,
          id: id,
          content: String(content || "").slice(0, 6000),
          specs: specs || []
        }, function (res) {
          clearTimeout(timer);
          if (runtime.lastError) finish(null);
          else finish(res || null);
        });
      } catch (error) {
        clearTimeout(timer);
        finish(null);
      }
    });
  }

  function eachFeature(state, content) {
    if (!state || !state.enabled) return;
    const key = typeof state.apiKey === "string" ? state.apiKey.trim() : "";
    if (!key) return;
    const text = String(content || "").trim();
    if (!text) return;
    const features = state.features || {};
    Object.keys(PAGE).forEach(function (id) {
      if (!features[id]) return;
      item(id, id, text, [PAGE[id]]).catch(function () {});
    });
  }

  root.JEVAsk = { item: item, eachFeature: eachFeature, PAGE: PAGE };
})(typeof globalThis !== "undefined" ? globalThis : this);
