---
name: umby-jev-secrets
description: >-
  Skill 3 of Umby Jev Stack. Stricter secret and PII sweep — independent Nouls for API keys,
  tokens, passwords, private keys, connection strings, emails, account IDs. Compile every
  hit. HTTP-first. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.0.0"
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
