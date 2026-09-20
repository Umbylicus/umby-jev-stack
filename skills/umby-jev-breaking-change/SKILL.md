---
name: umby-jev-breaking-change
description: >-
  Skill 4 of Umby Jev Stack. Detect API, schema, and export contract breaks via independent
  Nouls (removed exports, renamed fields, type changes, required fields, endpoints, enums).
  Compile every hit. HTTP-first. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.1.0"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-breaking-change
---

# Umby Jev Breaking Change (skill 4)

Part of the [Umby Jev Stack](https://github.com/Umbylicus/umby-jev-stack) skill tree. Flag **API, schema, and export contract breaks** with independent Nouls — ideal for semver and changelog gates.

## Hunt Nouls

| Question | Detects |
| --- | --- |
| `has_removed_export` | Removed public symbol |
| `has_renamed_field` | Renamed public field / JSON key |
| `has_type_change` | Breaking type or format change |
| `has_new_required_field` | New required field or parameter |
| `has_endpoint_change` | Removed/renamed HTTP route or method |
| `has_enum_break` | Removed/renamed enum or union value |

Canonical copy: [`questions.json`](questions.json)

## Scope

- Prefer diff/patch state when reviewing PRs; whole file OK for schema definitions.
- Include related type/interface/schema context in state when needed.

## Compile pass

One row per noul ≥ 0.5. A single change can break multiple contracts — list them all.

## Rules

1. HTTP-only Jev; no fixes in instructions.
2. Present compiled break list before version bumps or release notes.
3. Agent confirms each flag; intentional contract breaks still count, with intent recorded separately.

## Shared execution and compile contract

Use [TypeSafe Advanced: structure](https://docs.typesafe.ai/primitives/advanced): load structured instructions, criteria and ignore lists from `questions.json`; keep questions fixed during a run. Independent Nouls are evaluated together, never collapsed into a winning category.

HTTP-first: `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $JEV_API_KEY`, `Content-Type: application/json`, body `{ "model": "jev-latest", "state": { "path": "<source identifier>", "kind": "<source type>", "content": "<scoped evidence>" }, "questions": <questions.json object> }`. This tree uses `JEV_API_KEY`; SDK examples may use `TYPESAFE_API_KEY`. Never print the key. Add language and original chunk/line ranges for code slices; keep `state.content` ≤ 10,000 characters. Record context coverage and report missing context explicitly.

Validate all expected answers and finite Noul values in [0,1]. Failed, missing or malformed responses are incomplete work, never clean results. Compile each Noul ≥ 0.5 independently with path, kind, range, question, exact noul, returned model, and quoted evidence or `unlocated`. Mask sensitive values in state, logs and reports while retaining their credential role and a local source reference for look-only confirmation; do not replace a suspected capability token with an ordinary placeholder and silently declare it clean.

Jev classifies only. Confirm/compile agents are look-only: re-read evidence, mark confirmed/rejected/needs-context, and explain a possible remedy in the compile. They must not edit application code, apply patches, delete files, or execute the screened commands. A human reviews the full compiled list and decides on any separate follow-up.

Include `before`, `after`, contract visibility and compatibility adapters. A whole schema without its prior contract cannot establish a break; record `needs-context`.
