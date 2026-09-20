---
name: umby-jev-stack
description: >-
  Run TypeSafe Jev as a cheap code-review classifier over HTTP (api.typesafe.ai).
  Use when the user wants a Jev sweep, security/syntax/schema pass, or compiled
  findings before fixes — in Cursor, Claude Code, Codex, or any agent with shell/HTTP.
  Frozen labels: Clean_Codebase, Syntax_Or_Type_Error, Vulnerability_Flagged,
  Schema_Mismatch. Never hallucinate fixes inside Jev; never drop a finding;
  fix only after the user reviews compiled results. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.0.0"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack
  openclaw:
    primaryEnv: JEV_API_KEY
    requires:
      env:
        - JEV_API_KEY
    envVars:
      - name: JEV_API_KEY
        required: true
        description: TypeSafe Jev API key from console.typesafe.ai/settings/keys
---

# Umby Jev Stack

Run **TypeSafe Jev** as a cheap classifier — not a chat model. One `POST` per file or coherent chunk; compile every non-clean answer; **never drop a finding**. Jev labels; **you** confirm and propose fixes **only after the user reviews** the compiled report.

Works with `curl`, `fetch`, Node, or Python. No Cursor-only tools required.

Optional richer loop: community [jev-review MCP](https://github.com/NiazMorshed2007/jev-review) (install separately; not bundled here).

## Prerequisites

1. `export JEV_API_KEY` in the shell (or Runtime Secret on cloud agents).
2. Verify without printing the key: `test -n "$JEV_API_KEY" && echo ok`
3. Cloud VMs: desktop `mcp.json` does **not** travel — set `JEV_API_KEY` in the agent environment.

## Frozen review labels (do not rename)

| Label | Meaning |
| --- | --- |
| `Clean_Codebase` | No syntax/type errors, security issues, schema mismatches, or logic bugs worth flagging |
| `Syntax_Or_Type_Error` | Syntax, parse, or type error; missing import; invalid reference; would not compile/typecheck |
| `Vulnerability_Flagged` | Hardcoded secret/token, injection, XSS, broken auth, unsafe deserialization, path traversal, etc. |
| `Schema_Mismatch` | API/schema contract break — wrong field names, missing required fields, incompatible types vs declared schema/interface |

## Frozen Jev questions (copy verbatim)

Use **exactly** this `questions` object on every review call. Do not improvise new labels or reword criteria.

```json
{
  "review_label": {
    "type": "choice",
    "instructions": "Pick the single highest-priority label for this code snippet. If multiple issues exist, choose the most severe.",
    "criteria": {
      "Clean_Codebase": "No syntax/type errors, security issues, schema mismatches, or logic bugs worth flagging",
      "Syntax_Or_Type_Error": "Syntax, parse, or type error; missing import; invalid reference; code would not compile or typecheck",
      "Vulnerability_Flagged": "Hardcoded secret, injection, XSS, auth bypass, unsafe eval, or similar security flaw",
      "Schema_Mismatch": "API or schema contract break: wrong fields, missing required keys, incompatible types vs declared schema"
    }
  },
  "has_logic_bug": {
    "type": "noul",
    "instructions": "Does this snippet contain a logic bug (wrong condition, off-by-one, race, null mishandling) that could cause incorrect behavior in production?",
    "criteria": {
      "true": "A plausible logic defect is present",
      "false": "No logic defect worth flagging"
    }
  }
}
```

### Hunt list (agent responsibility, not Jev prose)

When selecting files and interpreting answers, prioritize:

- Syntax and type errors
- Secrets and tokens in source
- Injection (SQL, shell, template, LDAP)
- XSS and unsafe HTML/JS output
- Auth and authorization gaps
- Schema and API contract breaks
- Logic bugs surfaced by `has_logic_bug`

## HTTP contract

- **Endpoint:** `POST https://api.typesafe.ai/v1/systemone`
- **Auth:** `Authorization: Bearer $JEV_API_KEY`
- **Model:** `jev-latest` (log the versioned `model` field from each response)
- **State:** object with `path` and `content`, or a focused diff string. Keep under Jev token limits (~32k tokens for state); split large files into coherent chunks.

### Minimal request shape

```json
{
  "model": "jev-latest",
  "state": { "path": "relative/path.ts", "content": "...file text..." },
  "questions": { /* frozen block above */ }
}
```

### Example shell call

```bash
curl -s https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $JEV_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg path 'src/example.ts' \
    --rawfile content src/example.ts \
    --argjson questions '$(cat skills/umby-jev-stack/questions.json 2>/dev/null || echo '{}')' \
    '{model:"jev-latest",state:{path:$path,content:$content},questions:$questions}')"
```

If `questions.json` is not present, embed the frozen `questions` object inline (see above).

## Agent workflow

### 1. Scope

- Review files the user named, or changed files in the task.
- Include enough surrounding context for imports/types; exclude unrelated files.

### 2. Parallel Jev calls

- One request per file (or per chunk if over token limits).
- Run calls **in parallel** when the runtime allows.
- On `429` or rate limits, backoff and retry (SDKs do this automatically; with `curl`, sleep and retry).
- On `max_tokens_exceeded`, split the file and re-run; **do not skip**.

### 3. One compile pass

Merge every response into a single findings report:

| path | review_label | has_logic_bug | confidence | model |
| --- | --- | --- | --- | --- |

Rules:

- Include **every** file reviewed.
- If `review_label` is not `Clean_Codebase`, it is a **finding**.
- If `has_logic_bug` is true (noul ≥ 0.5), add a logic finding even when label is `Clean_Codebase`.
- Record `confidence` / `probabilities` from Jev when present.
- **Never drop a finding** to shorten the report.

### 4. Present to user — no fixes yet

- Show the compiled table and a short per-finding note: path, label, one-line evidence from the code.
- **Do not hallucinate fixes inside Jev calls.** Jev only classifies.
- **Do not edit code** until the user has reviewed the compiled findings.

### 5. After user review

- Re-read flagged snippets yourself; confirm or reject each Jev label.
- Apply fixes only for findings the user approves.
- Re-run Jev on changed files if the user wants verification.

## Rules (non-negotiable)

1. **Frozen questions** — use the JSON block above unchanged.
2. **No fixes in Jev** — never ask Jev to rewrite code or suggest patches in `instructions`.
3. **Never drop a finding** — if Jev flagged it, it appears in the compile table.
4. **User gate** — compiled report first; code changes second.
5. **Confirm flags** — you validate Jev output before fixing; Jev can misfire.
6. **No secrets in state** — redact live production secrets from snippets when possible; use placeholders in examples.

## Optional: jev-review MCP

For iterative dimension scores (security, complexity, tests, etc.) while coding:

```bash
npx plugins add NiazMorshed2007/jev-review
```

That MCP is independent. This skill stays HTTP-first so it works anywhere.

## References

- TypeSafe docs: https://docs.typesafe.ai/
- Jev API: `POST https://api.typesafe.ai/v1/systemone`
- jev-review (optional MCP): https://github.com/NiazMorshed2007/jev-review
