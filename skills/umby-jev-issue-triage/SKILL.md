---
name: umby-jev-issue-triage
description: >-
  Skill 8 of Umby Jev Stack. Triage issue or ticket text with one Choice (bug/feature/question/
  security) plus independent urgency Score. Not a severity winner-takes-all. HTTP-first.
  Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.0.0"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-issue-triage
---

# Umby Jev Issue Triage (skill 8)

Part of the [Umby Jev Stack](https://github.com/Umbylicus/umby-jev-stack) skill tree. **Classify and prioritize** issue/ticket text with two **independent** questions — not a single highest-priority Choice.

## Questions

| Key | Type | Purpose |
| --- | --- | --- |
| `issue_type` | **Choice** | bug · feature · question · security (categorization only) |
| `urgency` | **Score** | 1–10 attention needed (independent of type) |

Canonical copy: [`questions.json`](questions.json)

The Choice picks **one category label** — it does not hide other dimensions. Urgency is a separate Score, not a competing label.

## Compile output

| issue | issue_type | urgency | model |

Record both answers for every issue reviewed. If security type **and** high urgency, surface both explicitly.

## Rules

1. HTTP-only: one call per issue/ticket.
2. Jev triages only — does not close, assign, or comment on issues.
3. Agent presents triage table to user before routing or auto-labeling.
