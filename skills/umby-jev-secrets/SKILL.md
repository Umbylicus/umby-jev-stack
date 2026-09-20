---
name: umby-jev-secrets
description: >-
  Skill 3 of Umby Jev Stack. Stricter secret and PII sweep — independent Nouls for API keys,
  tokens, passwords, private keys, connection strings, emails, account IDs. Compile every
  hit. HTTP-first. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.1.0"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-secrets
---

# Umby Jev Secrets (skill 3)

Part of the [Umby Jev Stack](https://github.com/Umbylicus/umby-jev-stack) skill tree. **Stricter** secret and PII sweep than general review — seven independent Nouls, every hit gets a row.

## Hunt Nouls

| Question | Detects |
| --- | --- |
| `has_api_key` | Hardcoded API / access keys |
| `has_bearer_token` | Bearer, JWT, session, OAuth tokens |
| `has_password` | Passwords, passphrases, PINs |
| `has_private_key` | PEM, SSH, signing key material |
| `has_connection_string` | DB/service URLs with embedded creds |
| `has_email_pii` | Real-looking personal emails |
| `has_account_id` | Account, customer, SSN-like IDs |

Canonical copy: [`questions.json`](questions.json)

## Compile pass

One row per noul ≥ 0.5. Multiple secret types in one file → multiple rows. **Never collapse.**

## Rules

1. `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`, `JEV_API_KEY`
2. Fan out one call per file/chunk; parallel OK.
3. Jev classifies only — user reviews before any redaction or rotation work.
4. Do not print or commit discovered secret values.

## Shared execution and compile contract

Use [TypeSafe Advanced: structure](https://docs.typesafe.ai/primitives/advanced): load structured instructions, criteria and ignore lists from `questions.json`; keep questions fixed during a run. Independent Nouls are evaluated together, never collapsed into a winning category.

HTTP-first: `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $JEV_API_KEY`, `Content-Type: application/json`, body `{ "model": "jev-latest", "state": { "path": "<source identifier>", "kind": "<source type>", "content": "<scoped evidence>" }, "questions": <questions.json object> }`. This tree uses `JEV_API_KEY`; SDK examples may use `TYPESAFE_API_KEY`. Never print the key. Add language and original chunk/line ranges for code slices; keep `state.content` ≤ 10,000 characters. Record context coverage and report missing context explicitly.

Validate all expected answers and finite Noul values in [0,1]. Failed, missing or malformed responses are incomplete work, never clean results. Compile each Noul ≥ 0.5 independently with path, kind, range, question, exact noul, returned model, and quoted evidence or `unlocated`. Mask sensitive values in state, logs and reports while retaining their credential role and a local source reference for look-only confirmation; do not replace a suspected capability token with an ordinary placeholder and silently declare it clean.

Jev classifies only. Confirm/compile agents are look-only: re-read evidence, mark confirmed/rejected/needs-context, and explain a possible remedy in the compile. They must not edit application code, apply patches, delete files, or execute the screened commands. A human reviews the full compiled list and decides on any separate follow-up.
