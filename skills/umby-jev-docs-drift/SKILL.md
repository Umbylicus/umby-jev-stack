---
name: umby-jev-docs-drift
description: >-
  Skill 9 of Umby Jev Stack. Flag documentation paragraphs that assert specific versions,
  prices, API surfaces, feature availability, or quotas — independent Nouls only. Jev detects
  claims; does NOT verify version numbers. LLM verifies later. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.1.0"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-docs-drift
---

# Umby Jev Docs Drift (skill 9)

Part of the [Umby Jev Stack](https://github.com/Umbylicus/umby-jev-stack) skill tree. Find **drift-prone claims** in docs — paragraphs that assert specific versions, prices, or API details. Jev **flags claims only**; a coding agent or human verifies accuracy later.

## Hunt Nouls

| Question | Detects |
| --- | --- |
| `has_version_claim` | Specific version / "requires vX.Y" |
| `has_price_claim` | Specific price, fee, or cost |
| `has_api_surface_claim` | Named endpoints, methods, params |
| `has_feature_availability_claim` | Feature exists / GA / plan availability |
| `has_limit_or_quota_claim` | Numeric limits, quotas, SLAs |

Canonical copy: [`questions.json`](questions.json)

## Critical rule

**Jev must NOT compare version numbers or prices to reality.** Instructions ask only: "does this paragraph *assert* a specific value?" Verification is a separate LLM or human step.

## Scope

- One call per paragraph or short section (heading + body).
- State: `{ "path": "docs/api.md#auth", "content": "<paragraph text>" }`

## Compile pass

| path | question | noul | quoted_claim |

One row per noul ≥ 0.5. Extract the asserted claim text for later verification.

## Rules

1. HTTP-only; no doc rewrites in Jev.
2. Present claim inventory to user before editing docs.
3. Never treat Jev noul as proof of incorrectness — only a signal of a **claim worth checking**.

## Shared execution and compile contract

Use [TypeSafe Advanced: structure](https://docs.typesafe.ai/primitives/advanced): load structured instructions, criteria and ignore lists from `questions.json`; keep questions fixed during a run. Independent Nouls are evaluated together, never collapsed into a winning category.

HTTP-first: `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $JEV_API_KEY`, `Content-Type: application/json`, body `{ "model": "jev-latest", "state": { "path": "<source identifier>", "kind": "<source type>", "content": "<scoped evidence>" }, "questions": <questions.json object> }`. This tree uses `JEV_API_KEY`; SDK examples may use `TYPESAFE_API_KEY`. Never print the key. Add language and original chunk/line ranges for code slices; keep `state.content` ≤ 10,000 characters. Record context coverage and report missing context explicitly.

Validate all expected answers and finite Noul values in [0,1]. Failed, missing or malformed responses are incomplete work, never clean results. Compile each Noul ≥ 0.5 independently with path, kind, range, question, exact noul, returned model, and quoted evidence or `unlocated`. Mask sensitive values in state, logs and reports while retaining their credential role and a local source reference for look-only confirmation; do not replace a suspected capability token with an ordinary placeholder and silently declare it clean.

Jev classifies only. Confirm/compile agents are look-only: re-read evidence, mark confirmed/rejected/needs-context, and explain a possible remedy in the compile. They must not edit application code, apply patches, delete files, or execute the screened commands. A human reviews the full compiled list and decides on any separate follow-up.
