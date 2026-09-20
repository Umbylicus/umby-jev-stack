---
name: umby-jev-stack
description: >-
  Run TypeSafe Jev as a cheap code-review classifier over HTTP (api.typesafe.ai).
  Use when the user wants a Jev sweep, security/syntax/schema pass, or compiled
  findings before fixes — in Cursor, Claude Code, Codex, or any agent with shell/HTTP.
  Independent Noul questions per hunt (syntax, secrets, injection/XSS, auth, schema,
  logic). Frozen compile labels: Clean_Codebase, Syntax_Or_Type_Error,
  Vulnerability_Flagged, Schema_Mismatch. Never pick one winner; never drop a finding;
  fix only after the user reviews compiled results. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.1.0"
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

Run **TypeSafe Jev** as a cheap classifier — not a chat model. One `POST` per file or coherent chunk; **independent Noul questions per hunt** so every issue can fire on the same snippet; compile **every** positive flag; **never drop a finding**. Jev classifies; **you** confirm and propose fixes **only after the user reviews** the compiled report.

Works with `curl`, `fetch`, Node, or Python. No Cursor-only tools required.

Optional richer loop: community [jev-review MCP](https://github.com/NiazMorshed2007/jev-review) (install separately; not bundled here).

## Prerequisites

1. `export JEV_API_KEY` in the shell (or Runtime Secret on cloud agents).
2. Verify without printing the key: `test -n "$JEV_API_KEY" && echo ok`
3. Cloud VMs: desktop `mcp.json` does **not** travel — set `JEV_API_KEY` in the agent environment.

**Name must be exactly `JEV_API_KEY`** — not `Jev_API_KEY`, not `TYPESAFE_API_KEY`.

## Frozen compile labels (do not rename)

These labels appear in the **compiled findings table**. They are **derived** from independent Noul answers — never from a single Choice that picks one winner.

| Label | Maps from (noul ≥ 0.5) |
| --- | --- |
| `Syntax_Or_Type_Error` | `has_syntax_or_type_error` |
| `Vulnerability_Flagged` | `has_exposed_secret`, `has_injection_or_xss`, or `has_insecure_auth` |
| `Schema_Mismatch` | `has_schema_mismatch` |
| *(logic finding)* | `has_logic_bug` — record as `Logic_Bug` or note in evidence column |
| `Clean_Codebase` | **Compile-time only** — assign when **no** issue noul fires for that snippet |

**Never use a single Choice question** that asks Jev to pick the highest-priority label. That hides co-occurring issues (e.g. a secret plus a schema break in the same file).

## Frozen Jev questions (copy verbatim)

Use **exactly** this `questions` object on every review call. Do not improvise new question keys or reword criteria. Ship canonical copy: [`questions.json`](questions.json).

```json
{
  "has_syntax_or_type_error": {
    "type": "noul",
    "instructions": "Does this snippet contain a syntax, parse, or type error; missing import; invalid reference; or other defect that would prevent compile or typecheck?",
    "criteria": {
      "true": "A syntax, parse, or type error is present",
      "false": "No syntax or type error worth flagging"
    }
  },
  "has_exposed_secret": {
    "type": "noul",
    "instructions": "Does this snippet contain a hardcoded secret, API key, token, password, or other credential exposed in source?",
    "criteria": {
      "true": "A hardcoded secret or exposed credential is present",
      "false": "No exposed secret worth flagging"
    }
  },
  "has_injection_or_xss": {
    "type": "noul",
    "instructions": "Does this snippet contain an injection risk (SQL, shell, template, LDAP, command) or XSS / unsafe HTML or JS output?",
    "criteria": {
      "true": "An injection or XSS risk is present",
      "false": "No injection or XSS risk worth flagging"
    }
  },
  "has_insecure_auth": {
    "type": "noul",
    "instructions": "Does this snippet contain an authentication or authorization flaw (bypass, missing check, broken session, privilege escalation)?",
    "criteria": {
      "true": "An auth or authorization flaw is present",
      "false": "No auth flaw worth flagging"
    }
  },
  "has_schema_mismatch": {
    "type": "noul",
    "instructions": "Does this snippet break an API or schema contract (wrong field names, missing required keys, incompatible types vs declared schema or interface)?",
    "criteria": {
      "true": "A schema or API contract break is present",
      "false": "No schema mismatch worth flagging"
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

### Hunt list (one Noul per row — all run every time)

| Question key | Hunt |
| --- | --- |
| `has_syntax_or_type_error` | Syntax and type errors |
| `has_exposed_secret` | Secrets and tokens in source |
| `has_injection_or_xss` | Injection (SQL, shell, template, LDAP) and XSS |
| `has_insecure_auth` | Auth and authorization gaps |
| `has_schema_mismatch` | Schema and API contract breaks |
| `has_logic_bug` | Logic bugs |

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
  "questions": { /* frozen block above or questions.json */ }
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
    --slurpfile questions skills/umby-jev-stack/questions.json \
    '{model:"jev-latest",state:{path:$path,content:$content},questions:$questions[0]}')"
```

## Agent workflow

### 1. Scope

- Review files the user named, or changed files in the task.
- Include enough surrounding context for imports/types; exclude unrelated files.
- Whole-repo coverage = file/snippet fan-out; each snippet gets the **full** question set.

### 2. Parallel Jev calls

- One request per file (or per chunk if over token limits).
- Run calls **in parallel** when the runtime allows (parallel agents OK).
- Work **one file at a time** when applying fixes later; review can fan out.
- On `429` or rate limits, backoff and retry (SDKs do this automatically; with `curl`, sleep and retry).
- On `max_tokens_exceeded`, split the file and re-run; **do not skip**.

### 3. One compile pass — every flag, no winners

Expand each Jev response into **one row per positive finding**. A single snippet may produce multiple rows.

| path | label | question | noul | confidence | model | evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `src/auth.ts` | `Vulnerability_Flagged` | `has_exposed_secret` | 0.92 | … | jev-1.x | hardcoded token |
| `src/auth.ts` | `Schema_Mismatch` | `has_schema_mismatch` | 0.81 | … | jev-1.x | wrong field name |

Rules:

- **Threshold:** noul ≥ 0.5 → positive finding (record exact score).
- **Map labels:** syntax → `Syntax_Or_Type_Error`; secret / injection / auth → `Vulnerability_Flagged`; schema → `Schema_Mismatch`; logic → `Logic_Bug` (or dedicated column).
- **Multiple findings per path are required** when multiple nouls fire. Never collapse to one label.
- **Clean_Codebase:** add one summary row per snippet only when **all** issue nouls are below threshold.
- Include **every** file reviewed.
- Record `confidence` / `probabilities` from Jev when present.
- **Never drop a finding** to shorten the report.
- **Never pick the most important issue** — list them all.

### 4. Present to user — no fixes yet

- Show the compiled table and a short per-finding note: path, label, question key, one-line evidence from the code.
- **Do not hallucinate fixes inside Jev calls.** Jev only classifies.
- **Do not edit code** until the user has reviewed the compiled findings.

### 5. After user review

- Re-read flagged snippets yourself; confirm or reject each flag.
- Apply fixes only for findings the user approves (one file at a time).
- Re-run Jev on changed files if the user wants verification.

## Rules (non-negotiable)

1. **Frozen questions** — use the JSON block above unchanged; independent Nouls only, no single Choice.
2. **No fixes in Jev** — never ask Jev to rewrite code or suggest patches in `instructions`.
3. **Never drop a finding** — if a noul fired, it appears in the compile table.
4. **Never pick one winner** — co-occurring issues all get rows.
5. **User gate** — compiled report first; code changes second.
6. **Confirm flags** — you validate Jev output before fixing; Jev can misfire.
7. **No secrets in state** — redact live production secrets from snippets when possible; use placeholders in examples.

## Optional: jev-review MCP

For iterative dimension scores (security, complexity, tests, etc.) while coding:

```bash
npx plugins add NiazMorshed2007/jev-review
```

That MCP is independent. This skill stays **HTTP-first** so it works anywhere without MCP.

## References

- TypeSafe docs: https://docs.typesafe.ai/
- Jev API: `POST https://api.typesafe.ai/v1/systemone`
- jev-review (optional MCP): https://github.com/NiazMorshed2007/jev-review
