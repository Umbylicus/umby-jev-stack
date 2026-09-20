---
name: umby-jev-browser
description: >-
  Skill 10 of Umby Jev Stack. Jev-driven browser loop — thin driver (Playwright,
  screenshot+a11y, or Cursor computer-use) observes each step; Jev is the policy
  (independent error Nouls + Choice next_action). Same pattern as browser-use/jev-ultrafast,
  Stagehand+a11y, typesafe-computer-use, and game-state demos (Doom, Mario). Compile
  every error noul ≥ 0.5 plus click path. No code fixes. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.0.0"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-browser
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

# Umby Jev Browser (skill 10)

Part of the [Umby Jev Stack](https://github.com/Umbylicus/umby-jev-stack) skill tree. **Jev browses through a harness loop** — the same architecture used in production browser agents, computer-use demos, and game bots:

| Reference | State | Jev role |
| --- | --- | --- |
| [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast) | Indexed element table per page | Choice: operation + target in one call |
| [Stagehand + Jev](https://www.langchain.com/blog/building-a-harness-with-jev) (Browserbase) | Accessibility tree + recent actions | Choice next action; Nouls for readiness |
| [typesafe-computer-use](https://github.com/awlevin/typesafe-computer-use) | OCR text layout (no screenshot to Jev) | Choice next action per step |
| [TypeSafe Doom / Mario](https://typesafe.ai/blog/introducing-system-one-models-and-jev) | Structured game state JSON | Choice manoeuvres + Nouls for errors |

**Jev is the policy.** A thin driver only observes the surface, calls Jev, and executes exactly one `next_action`. The driver never improvises navigation.

Works with Playwright, Puppeteer, Cursor `computerUse`, or any tool that can return URL, title, text/a11y excerpt, console errors, failed network, and clickable element ids.

## Architecture

```
seed URLs ──► driver.observe() ──► build state + merge click:<id> criteria
                      ▲                        │
                      │                        ▼
                 driver.act() ◄── Choice next_action + Nouls (every step)
                      │
                      └── loop until done or max_steps (default 30)
```

1. **Observe** — driver captures page state (DOM excerpt, a11y tree, or screenshot-derived text). Mint stable `id` per clickable element (`text` / `href` only in state).
2. **Ask Jev** — one `POST` per step with frozen error Nouls + `next_action` Choice (driver merges `click:<id>` criteria from `clickable_elements`).
3. **Compile errors** — record every noul ≥ 0.5 for this step (independent flags; never collapse to one winner).
4. **Act** — driver executes **only** the chosen `next_action`, then observes again.
5. **Repeat** — until Jev returns `done`, `max_steps` reached, or seed URL list exhausted.

Perception stays in code; judgment stays in Jev. Same split as drone and Mario demos: *"Jev cannot be the perception layer"* — your driver builds deterministic state.

## Prerequisites

1. `export JEV_API_KEY` (or Runtime Secret on cloud agents). Name must be exactly `JEV_API_KEY`.
2. Verify: `test -n "$JEV_API_KEY" && echo ok`
3. A browser driver: Playwright, Stagehand, Cursor computer-use, or custom.

## Frozen questions (copy verbatim)

Ship canonical copy: [`questions.json`](questions.json).

**Error Nouls (independent — all run every step):**

| Question key | Detects |
| --- | --- |
| `has_js_exception` | `console.error` / uncaught JS |
| `has_failed_network` | 4xx/5xx, blocked, `net::ERR` |
| `has_blank_or_error_page` | Blank, 404/500, missing main content |
| `has_broken_cta` | Dead or noop primary CTA |
| `has_auth_failure` | Login error, session expired, access denied |
| `has_a11y_blocker` | Missing name, keyboard trap, invisible focus |

**Policy Choice (separate from error Nouls):**

| Question key | Type | Purpose |
| --- | --- | --- |
| `next_action` | **Choice** | Exactly one driver action this step |

Frozen `next_action` criteria include `type_into`, `go_url`, `done`. **Before each call**, merge one criterion per clickable element:

```json
"click:el-3": "Click: Submit (/checkout)"
```

Only ids present in `state.clickable_elements` may appear. Never ask Jev to pick a click id you did not offer.

## State shape (per step)

Keep under Jev token limits (~32k). Prefer a11y tree or visible-text excerpt over full HTML.

```json
{
  "goal": "Smoke-test login flow",
  "seed_url": "https://example.com/login",
  "url": "https://example.com/login",
  "title": "Sign in",
  "visible_text_excerpt": "Email … Password … Sign in",
  "html_excerpt": "<form>…</form>",
  "console_errors": [],
  "failed_network": [],
  "clickable_elements": [
    { "id": "el-0", "text": "Sign in", "href": null },
    { "id": "el-1", "text": "Forgot password?", "href": "/reset" }
  ],
  "pending_type_text": null,
  "pending_url": null,
  "step": 1,
  "max_steps": 30,
  "click_path": [],
  "recent_actions": []
}
```

For computer-use / game-style surfaces, replace page fields with your structured observation (`game_state`, `ui_elements`, etc.) but keep the same question keys.

## HTTP contract

- **Endpoint:** `POST https://api.typesafe.ai/v1/systemone`
- **Auth:** `Authorization: Bearer $JEV_API_KEY`
- **Model:** `jev-latest` (log versioned `model` from each response)

### Request shape

```json
{
  "model": "jev-latest",
  "state": { /* per-step object above */ },
  "questions": {
    /* nouls from questions.json */,
    "next_action": {
      "type": "choice",
      "instructions": "…",
      "criteria": {
        "type_into": "…",
        "go_url": "…",
        "done": "…",
        "click:el-0": "Click: Sign in",
        "click:el-1": "Click: Forgot password? (/reset)"
      }
    }
  }
}
```

### Example shell call

```bash
# Build questions with merged click criteria (jq example)
jq -n \
  --argjson state "$STATE_JSON" \
  --slurpfile base questions.json \
  --argjson clicks '{"click:el-0":"Click: Sign in","click:el-1":"Click: Forgot password? (/reset)"}' \
  '{
    model: "jev-latest",
    state: $state,
    questions: ($base[0] | .next_action.criteria += $clicks)
  }' | curl -s https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $JEV_API_KEY" \
  -H "Content-Type: application/json" \
  -d @-
```

## Driver act mapping

| `next_action` answer | Driver executes |
| --- | --- |
| `click:<id>` | Click element with matching `id` in last observation |
| `type_into` | Type `state.pending_type_text` into focused/target input |
| `go_url` | `page.goto(state.pending_url)` |
| `done` | End loop for this seed URL; append to run report |

After each act, append to `click_path` (clicks only) and `recent_actions` (all actions). Re-observe before the next Jev call.

**Typing free text:** Jev does not generate strings. When `type_into` is likely, set `pending_type_text` in code (fixture, env, or a separate writing model). Same pattern as jev-ultrafast (small LLM only for `TYPE_TEXT`).

## Seed URL list

Default sources (driver builds the list; Jev does not):

- `sitemap.xml` URLs (same origin, cap count)
- CRM or app route manifest the user provides
- Explicit URL list in the task prompt

Run the loop once per seed URL (or until global step budget). Reset `click_path` per seed.

## Agent workflow

### 1. Setup

- Install Playwright or enable Cursor computer-use.
- Load seed URLs. Set `max_steps` (default **30** per seed).
- Initialize empty compile tables: `error_findings`, `navigation_runs`.

### 2. Step loop (per seed URL)

1. Navigate driver to seed URL; observe.
2. Build state + merge `click:<id>` into `next_action.criteria`.
3. `POST` Jev with full `questions` (all Nouls + merged Choice).
4. **Compile errors** — for each error noul ≥ 0.5, append a row (see below). Multiple errors on one step → multiple rows.
5. Read `next_action` Choice; execute exactly that action in the driver.
6. If `done` or `step >= max_steps`, finish seed; else increment step and repeat from observe.

### 3. Compile pass — errors + path (no code fixes)

**Error findings** (one row per noul ≥ 0.5 per step):

| seed_url | step | url | question | noul | evidence |
| --- | --- | --- | --- | --- | --- |
| `/login` | 3 | `…/login` | `has_auth_failure` | 0.88 | "Invalid password" banner |

**Navigation run** (one row per seed):

| seed_url | steps | click_path | final_url | stopped_reason |
| --- | --- | --- | --- | --- |
| `/login` | 4 | `el-0 → el-2` | `…/dashboard` | `done` |

Rules:

- **Threshold:** noul ≥ 0.5 → positive finding.
- **Independent Nouls** — never a single severity Choice that hides co-occurring errors.
- **Never drop a finding** to shorten the report.
- **No code fixes** in this skill — compiled report only; user decides follow-ups.
- Log Jev `model` and Choice confidence when present.

### 4. Present to user

- Error findings table + navigation runs summary.
- Optional: per-step trace (step, url, next_action, nouls fired).
- Do **not** edit application code unless the user asks after reviewing findings.

## Rules (non-negotiable)

1. **Jev is the policy** — driver executes only `next_action`; no driver-side navigation heuristics.
2. **Frozen error Nouls** — use `questions.json` unchanged; independent Nouls only for errors.
3. **Dynamic click criteria only** — merge `click:<id>` per observation; never invent ids.
4. **One action per step** — one Jev call → one driver act → re-observe.
5. **Never pick one error winner** — co-occurring flags all get compile rows.
6. **No fixes in Jev** — Jev classifies and chooses actions; it does not patch code or HTML.
7. **No secrets in state** — redact tokens/passwords from excerpts and network logs.

## Optional integrations

- [jev-browser-pilot](https://pypi.org/project/jev-browser-pilot/) — Python Surface/Chooser loop with traces
- [jkudish/jev-browser](https://systemonemodels.org/examples/tools/jkudish-jev-browser/) — MCP browser tool with a11y output
- [langchain-typesafe](https://www.langchain.com/blog/building-a-harness-with-jev) — `TypeSafeClassifier` in agent middleware

## References

- TypeSafe System One: https://docs.typesafe.ai/
- Jev API: `POST https://api.typesafe.ai/v1/systemone`
- LangChain harness: https://www.langchain.com/blog/building-a-harness-with-jev
- Browser-use ultrafast: https://github.com/browser-use/jev-ultrafast
