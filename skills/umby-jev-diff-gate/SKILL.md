---
name: umby-jev-diff-gate
description: >-
  Skill 2 of Umby Jev Stack. Run the same independent hunt Nouls as umby-jev-review on a
  git diff or PR patch only — not whole files. Compile every positive flag per hunk.
  HTTP POST api.typesafe.ai. Never pick one winner. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.0.0"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-diff-gate
---

# Umby Jev Diff Gate (skill 2)

Part of the [Umby Jev Stack](https://github.com/Umbylicus/umby-jev-stack) skill tree. Apply the **same hunt Nouls** as [`umby-jev-review`](../umby-jev-review/SKILL.md) to **git diff or PR patch hunks only** — ideal for pre-merge gates.

## Scope

- Input: `git diff`, `git show`, or PR patch text — one Jev call per file-hunk or coherent patch chunk.
- State shape: `{ "path": "file.ts", "content": "<diff hunk text>" }`
- Do **not** send whole files unless no diff is available.

## Frozen questions

Use [`questions.json`](questions.json) verbatim — six independent Nouls (syntax, secrets, injection/XSS, auth, schema, logic) scoped to **lines changed in the diff**.

## Compile pass

| path | hunk | question | noul | evidence |
| --- | --- | --- | --- | --- |

- noul ≥ 0.5 → one row per flag. Multiple rows per hunk allowed.
- **Never drop a finding.** **Never pick one winner.**

## Rules

1. HTTP-only: `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`, `Authorization: Bearer $JEV_API_KEY`
2. Jev classifies only — no fixes in Jev instructions.
3. Present compiled findings to the user before any code changes.
4. Redact live secrets in diff state when possible.
