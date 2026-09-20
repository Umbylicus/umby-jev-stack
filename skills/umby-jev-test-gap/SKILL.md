---
name: umby-jev-test-gap
description: >-
  Skill 5 of Umby Jev Stack. Flag behavior changes that appear untested — independent Nouls
  for logic changes, missing test updates, missing test files, public API without tests, and
  untested edge cases. Compile every hit. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.1.0"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-test-gap
---

# Umby Jev Test Gap (skill 5)

Part of the [Umby Jev Stack](https://github.com/Umbylicus/umby-jev-stack) skill tree. Surface **behavior changes without adequate test coverage** — independent Nouls, every gap gets a row.

## Hunt Nouls

| Question | Detects |
| --- | --- |
| `has_behavior_change` | Runtime logic or output changed |
| `has_no_test_update` | Behavior changed, no test diff in context |
| `has_no_test_file` | Module appears to lack any test file |
| `touches_public_api_without_test` | Public API changed, no test changes |
| `has_edge_case_untested` | New branches/paths appear untested |

Canonical copy: [`questions.json`](questions.json)

## Scope

- Provide diff **plus** related test file paths/content in state when possible so Jev can judge gaps.
- Split large diffs per file; include test directory listing in state if helpful.

## Compile pass

One row per noul ≥ 0.5. A change can trigger multiple gap types — list all.

## Rules

1. HTTP-only; Jev does not write tests.
2. Present gap report to user before adding tests.
3. Agent may suggest test areas only **after** user reviews flags.

## Shared execution and compile contract

Use [TypeSafe Advanced: structure](https://docs.typesafe.ai/primitives/advanced): load structured instructions, criteria and ignore lists from `questions.json`; keep questions fixed during a run. Independent Nouls are evaluated together, never collapsed into a winning category.

HTTP-first: `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $JEV_API_KEY`, `Content-Type: application/json`, body `{ "model": "jev-latest", "state": { "path": "<source identifier>", "kind": "<source type>", "content": "<scoped evidence>" }, "questions": <questions.json object> }`. This tree uses `JEV_API_KEY`; SDK examples may use `TYPESAFE_API_KEY`. Never print the key. Add language and original chunk/line ranges for code slices; keep `state.content` ≤ 10,000 characters. Record context coverage and report missing context explicitly.

Validate all expected answers and finite Noul values in [0,1]. Failed, missing or malformed responses are incomplete work, never clean results. Compile each Noul ≥ 0.5 independently with path, kind, range, question, exact noul, returned model, and quoted evidence or `unlocated`. Mask sensitive values in state, logs and reports while retaining their credential role and a local source reference for look-only confirmation; do not replace a suspected capability token with an ordinary placeholder and silently declare it clean.

Jev classifies only. Confirm/compile agents are look-only: re-read evidence, mark confirmed/rejected/needs-context, and explain a possible remedy in the compile. They must not edit application code, apply patches, delete files, or execute the screened commands. A human reviews the full compiled list and decides on any separate follow-up.

Include `changed_files`, `test_paths`, relevant test assertions and `test_search_coverage`. Distinguish unchanged tests from inadequate coverage; do not infer missing tests from an isolated source hunk. `has_behavior_change` is informational, not itself a defect.
