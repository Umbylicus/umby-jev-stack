---
name: umby-jev-issue-triage
description: >-
  Skill 8 of Umby Jev Stack. Triage issue or ticket text with one Choice (bug/feature/question/
  security/other) plus independent urgency Score and security Noul. Not a severity winner-takes-all. HTTP-first.
  Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "2.0.0"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-issue-triage
---

# Umby Jev Issue Triage (skill 8)

Part of the [Umby Jev Stack](https://github.com/Umbylicus/umby-jev-stack) skill tree. **Classify and prioritize** issue/ticket text with independent category, urgency and security questions — not a single highest-priority Choice.

## Questions

| Key | Type | Purpose |
| --- | --- | --- |
| `issue_type` | **Choice** | bug · feature · question · security · other (categorization only) |
| `urgency` | **Score** | 1–10 displayed attention needed (independent of type) |
| `has_security_concern` | **Noul** | Security concern regardless of primary category |

Canonical copy: [`questions.json`](questions.json)

The Choice picks **one category label** — it does not hide other dimensions. Urgency is a separate Score, not a competing label.

## Compile output

| issue | issue_type | urgency | model |

Record category, urgency and independent security answer for every issue. Surface security findings regardless of primary category.

## Rules

1. HTTP-only: one call per issue/ticket.
2. Jev triages only — does not close, assign, or comment on issues.
3. Agent presents triage table to user before routing or auto-labeling.

## Shared execution and compile contract

Use [TypeSafe Advanced: structure](https://docs.typesafe.ai/primitives/advanced): load structured instructions, criteria and ignore lists from `questions.json`; keep questions fixed during a run. Independent Nouls are evaluated together, never collapsed into a winning category.

HTTP-first: `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $JEV_API_KEY`, `Content-Type: application/json`, body `{ "model": "jev-latest", "state": { "path": "<source identifier>", "kind": "<source type>", "content": "<scoped evidence>" }, "questions": <questions.json object> }`. This tree uses `JEV_API_KEY`; SDK examples may use `TYPESAFE_API_KEY`. Never print the key. Add language and original chunk/line ranges for code slices; keep `state.content` ≤ 10,000 characters. Record context coverage and report missing context explicitly.

Validate all expected answers and finite Noul values in [0,1]. Failed, missing or malformed responses are incomplete work, never clean results. Compile each Noul ≥ 0.5 independently with path, kind, range, question, exact noul, returned model, and quoted evidence or `unlocated`. Mask sensitive values in state, logs and reports while retaining their credential role and a local source reference for look-only confirmation; do not replace a suspected capability token with an ordinary placeholder and silently declare it clean.

Jev classifies only. Confirm/compile agents are look-only: re-read evidence, mark confirmed/rejected/needs-context, and explain a possible remedy in the compile. They must not edit application code, apply patches, delete files, or execute the screened commands. A human reviews the full compiled list and decides on any separate follow-up.

`has_security_concern` is an independent Noul; compile every value ≥ 0.5 regardless of the chosen category. `issue_type` also offers `other`. Urgency uses ten ordered criteria (API score 0–9); display `urgency = answers.urgency.score + 1` on the advertised 1–10 scale, retaining raw score, probabilities and confidence. Do not interpret the Score as a Noul probability.
