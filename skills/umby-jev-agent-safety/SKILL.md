---
name: umby-jev-agent-safety
description: >-
  Skill 6 of Umby Jev Stack. Screen planned agent tool calls and shell commands for destructive
  risk before execution — independent Nouls (recursive delete, force-push, DB destroy, prod
  deploy, secret exfil, privilege escalation, irreversible actions). Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.1.0"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-agent-safety
---

# Umby Jev Agent Safety (skill 6)

Part of the [Umby Jev Stack](https://github.com/Umbylicus/umby-jev-stack) skill tree. **Gate agent actions before execution** — classify planned tool calls, shell commands, or MCP invocations for destructive risk.

## When to use

Run **before** the agent executes a command batch — not after. State = proposed command(s) + brief context (cwd, target env).

## Hunt Nouls

| Question | Detects |
| --- | --- |
| `has_recursive_delete` | rm -rf, broad unlink |
| `has_force_push` | git push --force, hard reset |
| `has_database_destroy` | DROP, TRUNCATE, destructive migrations |
| `has_prod_deploy` | Production deploy without explicit approval |
| `has_secret_exfil` | Sending secrets to external URLs/logs |
| `has_privilege_escalation` | sudo, chmod 777, broad perms |
| `has_irreversible_action` | Billing, account closure, mass email |

Canonical copy: [`questions.json`](questions.json)

## Compile pass

| command | question | noul | evidence |

One row per noul ≥ 0.5. Record every flag and existing authorization; this screening skill never executes commands.

## Rules

1. HTTP-only Jev screening; Jev does not approve or rewrite commands.
2. A score does not grant or revoke authorization; the human decides any subsequent execution.
3. This skill gates execution — it does not replace human judgment on prod.

## Shared execution and compile contract

Use [TypeSafe Advanced: structure](https://docs.typesafe.ai/primitives/advanced): load structured instructions, criteria and ignore lists from `questions.json`; keep questions fixed during a run. Independent Nouls are evaluated together, never collapsed into a winning category.

HTTP-first: `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $JEV_API_KEY`, `Content-Type: application/json`, body `{ "model": "jev-latest", "state": { "path": "<source identifier>", "kind": "<source type>", "content": "<scoped evidence>" }, "questions": <questions.json object> }`. This tree uses `JEV_API_KEY`; SDK examples may use `TYPESAFE_API_KEY`. Never print the key. Add language and original chunk/line ranges for code slices; keep `state.content` ≤ 10,000 characters. Record context coverage and report missing context explicitly.

Validate all expected answers and finite Noul values in [0,1]. Failed, missing or malformed responses are incomplete work, never clean results. Compile each Noul ≥ 0.5 independently with path, kind, range, question, exact noul, returned model, and quoted evidence or `unlocated`. Mask sensitive values in state, logs and reports while retaining their credential role and a local source reference for look-only confirmation; do not replace a suspected capability token with an ordinary placeholder and silently declare it clean.

Jev classifies only. Confirm/compile agents are look-only: re-read evidence, mark confirmed/rejected/needs-context, and explain a possible remedy in the compile. They must not edit application code, apply patches, delete files, or execute the screened commands. A human reviews the full compiled list and decides on any separate follow-up.

State also includes `cwd`, resolved targets, environment, existing authorization and safeguards. Never execute a proposed command to determine its risk.
