---
name: umby-jev-test-gap
description: >-
  Skill 5 of Umby Jev Stack. Flag behavior changes that appear untested — independent Nouls
  for logic changes, missing test updates, missing test files, public API without tests, and
  untested edge cases. Compile every hit. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.0.0"
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
