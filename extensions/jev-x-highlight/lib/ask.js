(function (root) {
  function criterion(what, examples, fallback) {
    const text = typeof what === "string" && what.trim() ? what.trim() : fallback;
    if (!Array.isArray(examples) || !examples.length) return text;
    return { what: text, examples: examples };
  }

  function instructionsFor(spec) {
    const value = spec && spec.instructions;
    if (typeof value === "string" && value.trim()) return value;
    if (value && typeof value === "object") return value;
    return "Answer yes or no.";
  }

  function buildBody(feature, content, spec) {
    const row = spec && typeof spec === "object" ? spec : {};
    const key = row.key ? String(row.key) : "question";
    const questions = {};
    questions[key] = {
      type: "noul",
      instructions: instructionsFor(row),
      criteria: {
        true: criterion(row.yes, row.yesExamples, "Yes."),
        false: criterion(row.no, row.noExamples, "No.")
      }
    };
    return {
      model: "jev-latest",
      state: {
        path: "extension/" + String(feature || "item"),
        kind: "client",
        language: "html",
        content: String(content || "").slice(0, 6000)
      },
      questions: questions
    };
  }

  function finiteNoul(response, key) {
    const answers = response && response.answers;
    const row = answers && answers[key];
    if (!row) return null;
    const noul = typeof row.noul === "number" ? row.noul : Number(row.noul);
    return Number.isFinite(noul) ? noul : null;
  }

  function readNoul(response, key) {
    const noul = finiteNoul(response, key);
    return noul == null ? 0 : noul;
  }

  function hit(response, key) {
    const noul = finiteNoul(response, key);
    return noul != null && noul >= 0.5;
  }

  const api = { buildBody: buildBody, readNoul: readNoul, finiteNoul: finiteNoul, hit: hit };
  root.JEVAskBody = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
