---
name: umby-jev-agent-safety
description: >-
  Skill 6 of Umby Jev Stack. Screen planned agent tool calls and shell commands for destructive
  risk before execution — independent Nouls (recursive delete, force-push, DB destroy, prod
  deploy, secret exfil, privilege escalation, irreversible actions). Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.0.0"
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

One row per noul ≥ 0.5. **Block or ask user** when any flag fires — do not auto-run destructive commands.

## Rules

1. HTTP-only Jev screening; Jev does not approve or rewrite commands.
2. User must confirm before executing flagged commands.
3. This skill gates execution — it does not replace human judgment on prod.
