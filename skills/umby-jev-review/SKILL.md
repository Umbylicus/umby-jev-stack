---
name: umby-jev-review
description: >-
  Skill 1 of Umby Jev Stack. Run TypeSafe Jev as a cheap code-review classifier over
  HTTP (api.typesafe.ai). Use for a Jev sweep, security/syntax/schema pass, or compiled
  findings before fixes. Six independent Noul questions per hunt (syntax, secrets,
  injection/XSS, auth, schema, logic) tuned to flag executable defects only — never
  comments, imports, test fixtures, esc() HTML, parameterized SQL, or placeholder env
  values. State carries path, kind, language, chunk range, and imports so Jev knows what
  it is looking at. Frozen compile labels: Clean_Codebase, Syntax_Or_Type_Error,
  Vulnerability_Flagged, Schema_Mismatch, Logic_Bug. Never pick one winner; never drop a
  finding; fix only after user reviews. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "2.0.1"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-review
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

# Umby Jev Review (skill 1)

Part of the [Umby Jev Stack](https://github.com/Umbylicus/umby-jev-stack) skill tree. Run **TypeSafe Jev** as a cheap classifier — not a chat model. One `POST` per file or coherent chunk; **six independent Noul questions per hunt** so every issue can fire on the same snippet; compile **every** positive flag; **never drop a finding**. Jev classifies; **you** confirm and propose fixes **only after the user reviews** the compiled report.

Works with `curl`, `fetch`, Node, or Python. No Cursor-only tools required.

Optional richer loop: community [jev-review MCP](https://github.com/NiazMorshed2007/jev-review) (install separately; not bundled here).

## What changed in 2.0 (read this if you ran 1.x)

A 1.x full sweep of a ~1,200-snippet repo produced 544 flags; a manual confirm pass rejected 543 as false positives (comments, file headers, imports, test fixtures, `esc()`-wrapped HTML, parameterized SQL, ADR prose, dummy env strings). 386 of the 544 were `has_logic_bug` at noul 0.5–0.7. Root causes and the 2.0 fix for each:

| Root cause | 2.0 change |
| --- | --- |
| Questions asked about "plausible" defects anywhere in a snippet | Every question now demands a **specific executable statement** you could name, with explicit `ignore` lists and true/false examples ([`questions.json`](questions.json)) |
| Jev could not tell test, fixture, migration, or client code from server source | State now carries `path`, `kind`, `language` (see [State shape](#state-shape)) |
| 35k-char chunks (~700 lines) cut imports and declarations away; flagged chunks were 2× longer than clean ones | Chunks are 120–250 lines, split at top-level boundaries, and carry `chunk` range + the file's `imports` block |
| Compile-pass "evidence" was regex keyword guessing, so reviewers were shown the wrong line | Evidence must be **quoted from a re-read** or marked `unlocated`; optional localize pass bisects a flagged chunk |
| Every 0.5 flag looked equally urgent | Rows still start at noul ≥ 0.5, but a `tier` column marks confirm-first hits (≥ 0.7, or any security noul) |

Question **keys** and compile **labels** are unchanged, so 1.x reports remain comparable. Question **wording** is new; do not mix 1.x and 2.0 wording in one run.

## What changed in 2.0.1

| Change | Detail |
| --- | --- |
| HTTPS pool sized from the repo | Enumerate in-scope files, build snippets, set `concurrency = snippets.length` — one wave of keep-alive `POST`s when the runtime allows (50 snippets → 50 in-flight; 250 → 250). These are Jev HTTP calls, not Cursor agents. |
| Chunk cap is character-based | Each `state.content` ≤ **10,000 characters** (split at top-level boundaries when possible). Line-count targets from 2.0 are retired. |
| Backoff without pre-capping | On `EAGAIN` / `EMFILE` / `ECONNRESET` / HTTP `429`: retry with backoff; reduce concurrency only as much as needed after repeated failures — never default to a fixed low cap. |
| Compile threshold unchanged | Review compile still **noul ≥ 0.5**. Speedy Jev’s 0.70 gate is a different skill — do not apply here. |

Frozen [`questions.json`](questions.json) wording is unchanged.

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
| `Logic_Bug` | `has_logic_bug` |
| `Clean_Codebase` | **Compile-time only** — assign when **no** issue noul fires for that snippet |

**Never use a single Choice question** that asks Jev to pick the highest-priority label. That hides co-occurring issues (e.g. a secret plus a schema break in the same file).

## Frozen Jev questions (copy verbatim)

Use **exactly** the `questions` object in [`questions.json`](questions.json) on every review call. Do not improvise new question keys, and do not reword `instructions` or `criteria` mid-run. The six keys and their hunts:

| Question key | Hunt | Fires only when… |
| --- | --- | --- |
| `has_syntax_or_type_error` | Syntax and type errors | code (not comments/strings) cannot parse or typecheck; symbol provably undefined in the slice |
| `has_exposed_secret` | Secrets and tokens in source | a **literal** credential or capability token in non-test code would grant access if leaked (hardcoded share tokens count — policy call goes to the human) |
| `has_injection_or_xss` | Injection (SQL, shell, template, redirect) and XSS | an untrusted value reaches a sink **raw** — no `$1`/`?` binding, no `esc()`/escape call in between |
| `has_insecure_auth` | Auth and authorization gaps | server code shows a bypassable, unverified, inverted, or sibling-inconsistent check; never client UI, never "middleware might be elsewhere" |
| `has_schema_mismatch` | Schema and API contract breaks | declaration **and** contradicting usage are both visible in the snippet |
| `has_logic_bug` | Logic bugs | a named statement misbehaves on a nameable input; guards, empty catches, and comment-explained choices are not bugs |

Each question's `instructions` is a structured object (`question`, `inspect`, `context`, `focus`, `ignore`) and each `criteria.true` / `criteria.false` is `{ what, examples }`. TypeSafe accepts JSON structure in both fields; keep it — the `ignore` lists and examples are what removed the 1.x noise.

The canonical copy is `questions.json` in this folder. Load it from disk (`--slurpfile questions questions.json`) rather than pasting; that keeps the wording identical across every call in a run.

## HTTP contract

- **Endpoint:** `POST https://api.typesafe.ai/v1/systemone`
- **Auth:** `Authorization: Bearer $JEV_API_KEY`
- **Model:** `jev-latest` (log the versioned `model` field from each response)
- **State:** the object below. Keep well under Jev's state token limit (~32k tokens); the chunking rules keep you far below it.

### State shape

Send an object, not a bare string. The questions reference these keys by name.

```json
{
  "path": "apps/crm/src/routes/leads.ts",
  "kind": "source",
  "language": "typescript",
  "chunk": { "index": 2, "total": 4, "start_line": 181, "end_line": 402 },
  "imports": "import { Hono } from 'hono';\nimport { requireSession } from '../middleware/session';\nimport { db } from '../db';",
  "note": "Route module; requireSession is applied at the router in apps/crm/src/app.ts",
  "content": "...the file text or chunk text..."
}
```

| Key | Required | Meaning |
| --- | --- | --- |
| `path` | yes | Repo-relative path. Jev uses it to recognise `test/`, `client/`, `migrations/`, `.env.example`, etc. |
| `kind` | yes | One of `source`, `test`, `fixture`, `migration`, `config`, `script`, `env-example`, `client`. Derive from path (table below). |
| `language` | yes | `typescript`, `javascript`, `sql`, `html`, `css`, `shell`, `yaml`, `toml`, `json`. |
| `chunk` | when chunked | `{ index, total, start_line, end_line }` — tells Jev the slice is partial so it stops flagging "missing" imports and declarations. Omit for whole files. |
| `imports` | when chunked | Verbatim import/require block from the top of the file (and `export`ed type names if short). Include on **every** chunk. |
| `note` | optional | One line of human context you already know (e.g. which middleware protects the router). Never paste secrets here. |
| `content` | yes | The code. Do not strip comments — the questions are told to ignore them, and stripping shifts line numbers. |

**`kind` from path:**

| Path pattern | `kind` |
| --- | --- |
| `**/test/**`, `**/tests/**`, `**/__tests__/**`, `*.test.*`, `*.spec.*` | `test` |
| `**/fixtures/**`, `**/__fixtures__/**`, `**/mocks/**`, `**/seed*/**` | `fixture` |
| `**/migrations/**`, `*.sql` under a migrations or schema folder | `migration` |
| `*.env.example`, `.env.sample`, `.env.template` | `env-example` |
| `**/client/**`, `**/public/**`, `**/static/**`, browser bundles, `*.html` | `client` |
| `scripts/**`, `*.sh`, `*.mjs` at repo root | `script` |
| `*.json`, `*.toml`, `*.yaml`, `*.yml`, `wrangler.*`, `tsconfig*`, `package.json` | `config` |
| everything else executable | `source` |

### Scope — what to send

**Send:** `.ts .tsx .js .jsx .mjs .cjs .sql .html .sh .yaml .yml .toml`, plus `.json` config that is hand-written and `.env.example`. Tests **are** sent (as `kind: test`) — they can still contain a real secret or a real syntax error.

**Do not send:** Markdown, ADRs, changelogs, and other prose (use `umby-jev-docs-drift` for docs); lockfiles; `node_modules`, `dist`, `build`, `coverage`, `.wrangler`, `.next`, `.turbo`; minified or generated bundles (`*.min.*`, `*.map`, `*.d.ts` from build); images, fonts, binaries. These produce noise, not defects.

### Chunking

Jev makes gut-check judgments; oversized slabs were the strongest predictor of 1.x false positives. Size every snippet by **characters**, not line count.

1. **Whole file** when `content` ≤ **10,000 characters** (omit `chunk`).
2. Otherwise split at **top-level boundaries** (blank line between functions, classes, route registrations, SQL statements) into the fewest chunks where each `content` ≤ **10,000 characters**. Never split inside a function if you can avoid it; if a single function exceeds the cap, it is its own chunk (hard-split the text if one line alone exceeds 10k).
3. Every chunk gets the same `imports` block and its own `chunk` range. Line numbers are 1-based and refer to the original file.
4. Never overlap chunks (overlap duplicates rows). Never drop a chunk on `max_tokens_exceeded` — split it further and re-run.

### Minimal request shape

```json
{
  "model": "jev-latest",
  "state": { "path": "src/example.ts", "kind": "source", "language": "typescript", "content": "...file text..." },
  "questions": { /* contents of questions.json */ }
}
```

### Example shell call (whole file)

```bash
curl -s https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $JEV_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg path 'src/example.ts' \
    --arg kind 'source' \
    --arg language 'typescript' \
    --rawfile content src/example.ts \
    --slurpfile questions questions.json \
    '{model:"jev-latest",state:{path:$path,kind:$kind,language:$language,content:$content},questions:$questions[0]}')"
```

Response shape: `answers.<key>.noul` is a 0–1 probability; `model` is the versioned model id. Noul answers carry no separate `confidence`.

## Agent workflow

### 1. Scope

- Review files the user named, or changed files in the task.
- Apply the [scope](#scope--what-to-send) and [`kind`](#state-shape) tables; record the `kind` you assigned so reviewers see it in the compile table.
- Whole-repo coverage = file/snippet fan-out; each snippet gets the **full** six-question set.

### 2. Size the HTTPS pool from the repo (always)

Before the first Jev call, **measure the repo** and size the pool from that count — do not guess a fixed concurrency.

1. **Walk** the target repo for in-scope files ([scope](#scope--what-to-send)). Skip `node_modules`, `.git`, `dist`, `build`, `coverage`, `.wrangler`, `.next`, `.turbo`, and other excluded dirs while enumerating.
2. **Build snippets** — one per whole file or per [chunk](#chunking); each carries `path`, `kind`, `language`, optional `chunk` / `imports`, and `content` (≤ 10,000 chars).
3. **Count:** `N = snippets.length`.
4. **Concurrency:** `concurrency = N` for this run. Fire **one wave** of `N` in-flight `POST`s to `https://api.typesafe.ai/v1/systemone` when the runtime allows (50 snippets → 50 parallel Jev HTTP calls; 250 → 250). These are Jev HTTP requests, **not** Cursor agents or subagents.
5. **Keep-alive** — reuse connections (e.g. undici `Agent`, `fetch` with a keep-alive dispatcher, or equivalent) with pool size matching `N`.
6. **On pressure** — `EAGAIN`, `EMFILE`, `ECONNRESET`, connect timeouts, or HTTP `429`: exponential backoff and retry. **Reduce concurrency only as much as needed** after repeated failures in a window; do not pre-cap below `N` without cause.
7. **Log** at start: files scanned, `N`, and effective concurrency.

Optional reference runner (Project store): `internal/jev-full-scan-runner-v2.mjs` — follows this sizing contract; load frozen questions from [`questions.json`](questions.json).

### 3. Parallel Jev calls

- One request per snippet (whole file or chunk).
- Launch all `N` calls per [step 2](#2-size-the-https-pool-from-the-repo-always); work **one file at a time** when applying fixes later.
- On `max_tokens_exceeded`, split the chunk and re-run; **do not skip**.
- Persist raw responses (JSONL of `path`, `chunk`, `answers`, `model`) so the compile pass can be re-run without new Jev calls.

### 4. One compile pass — every flag, no winners

Expand each Jev response into **one row per positive finding**. A single snippet may produce multiple rows.

| path | kind | lines | label | question | noul | tier | model | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `src/auth.ts` | source | 1–88 | `Vulnerability_Flagged` | `has_exposed_secret` | 0.92 | A | jev-1.x | L41 `const TOKEN = "9f1c…"` |
| `src/auth.ts` | source | 1–88 | `Schema_Mismatch` | `has_schema_mismatch` | 0.81 | A | jev-1.x | L67 `lead.emial` vs `interface Lead` L12 |
| `src/util.ts` | source | 120–240 | `Logic_Bug` | `has_logic_bug` | 0.56 | B | jev-1.x | unlocated |

Rules:

- **Threshold:** noul ≥ **0.5** → positive finding (record the exact score). Nothing at or above 0.5 is dropped. This is the **review** compile gate — **Speedy Jev** (0.70) is a different skill; do not apply it here.
- **Tier column:** `A` (confirm first) when noul ≥ **0.7**, **or** when the question is `has_exposed_secret`, `has_injection_or_xss`, or `has_insecure_auth` at any score ≥ 0.5 — security hits are cheap to confirm and expensive to miss. `B` for syntax, schema, and logic hits in 0.5–0.7. Tier orders the confirm pass; it never removes a row.
- **Map labels:** syntax → `Syntax_Or_Type_Error`; secret / injection / auth → `Vulnerability_Flagged`; schema → `Schema_Mismatch`; logic → `Logic_Bug`.
- **Multiple findings per path are required** when multiple nouls fire. Never collapse to one label.
- **Clean_Codebase:** add one summary row per snippet only when **all** issue nouls are below threshold.
- Include **every** file reviewed and the `kind` you sent.
- **Evidence is quoted, never guessed.** Re-read the snippet and quote the line number plus the code you believe triggered the noul. If you cannot find a candidate statement, write `unlocated` — do **not** fall back to keyword regexes (`sql`, `token`, `if (`) to pick a line; 1.x did that and every reviewer was pointed at the wrong code. An `unlocated` row is a legitimate signal that the flag is probably noise.
- **Never drop a finding** to shorten the report.
- **Never pick the most important issue** — list them all.

#### Optional localize pass (recommended for chunked hits)

When a noul fires on a chunk longer than ~120 lines, re-run Jev on the two halves of that chunk (same `imports`, adjusted `chunk` range). Record the child scores next to the parent row:

- Both halves below 0.5 → note `localize: neither half re-fires`; the parent row stays, tier stays, and this is strong evidence for rejection.
- One half re-fires → quote evidence from that half and note its score.

This costs two extra calls per hit and turns most 0.5–0.7 flags into either a quotable line or a documented non-reproduction.

### 5. Present to user — no fixes yet

- Show the compiled table sorted by tier then path, and a short per-finding note: path, label, question key, quoted evidence.
- State the totals: snippets sent, clean, flagged, rows by tier.
- **Do not hallucinate fixes inside Jev calls.** Jev only classifies.
- **Do not edit code** until the user has reviewed the compiled findings.

### 6. After user review — confirm pass

- Re-read every flagged snippet yourself, tier A first; confirm or reject each row with a one-line reason.
- Reject reasons that are always valid (these were 543 of 544 rows in the 1.x sweep): the cited line is a comment, header, or prose; the value is a placeholder or read from env; the file is a test or fixture (`kind`); the HTML is constant or every dynamic part is wrapped in `esc()`; the SQL is parameterized or a migration; the "missing" symbol is imported or declared elsewhere in the file; the behaviour is an intentional guard explained by a comment or ADR; the auth check lives in router middleware.
- A hardcoded access or share token is **not** auto-rejected because the code calls it public — mark it `needs human (policy)` and let the user decide.
- Apply fixes only for findings the user approves (one file at a time).
- Re-run Jev on changed files if the user wants verification.

## Rules (non-negotiable)

1. **Frozen questions** — use `questions.json` unchanged for the whole run; six independent Nouls only, no single Choice.
2. **No fixes in Jev** — never ask Jev to rewrite code or suggest patches in `instructions`.
3. **Never drop a finding** — if a noul fired at ≥ 0.5, it appears in the compile table. Tier orders; it never filters.
4. **Never pick one winner** — co-occurring issues all get rows.
5. **User gate** — compiled report first; code changes second.
6. **Confirm flags** — you validate Jev output before fixing; Jev can misfire. Evidence is quoted or `unlocated`, never regex-guessed.
7. **State carries context** — always send `path`, `kind`, `language`; send `chunk` and `imports` on every partial slice.
8. **No secrets in state or notes** — redact live production secrets from snippets when possible; use placeholders in examples. Never put a real key in `note`.

## Optional: jev-review MCP

For iterative dimension scores (security, complexity, tests, etc.) while coding:

```bash
npx plugins add NiazMorshed2007/jev-review
```

That MCP is independent. This skill stays **HTTP-first** so it works anywhere without MCP.

## References

- TypeSafe docs: https://docs.typesafe.ai/ — see *State*, *Noul*, and *Advanced: structure* (structured `instructions` and `criteria`)
- Jev API: `POST https://api.typesafe.ai/v1/systemone`
- jev-review (optional MCP): https://github.com/NiazMorshed2007/jev-review
