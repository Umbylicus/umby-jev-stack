---
name: umby-jev-docs-drift
description: >-
  Skill 9 of Umby Jev Stack. Flag documentation paragraphs that assert specific versions,
  prices, API surfaces, feature availability, or quotas — independent Nouls only. Jev detects
  claims; does NOT verify version numbers. LLM verifies later. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.0.0"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-docs-drift
---

# Umby Jev Docs Drift (skill 9)

Part of the [Umby Jev Stack](https://github.com/Umbylicus/umby-jev-stack) skill tree. Find **drift-prone claims** in docs — paragraphs that assert specific versions, prices, or API details. Jev **flags claims only**; a coding agent or human verifies accuracy later.

## Hunt Nouls

| Question | Detects |
| --- | --- |
| `has_version_claim` | Specific version / "requires vX.Y" |
| `has_price_claim` | Specific price, fee, or cost |
| `has_api_surface_claim` | Named endpoints, methods, params |
| `has_feature_availability_claim` | Feature exists / GA / plan availability |
| `has_limit_or_quota_claim` | Numeric limits, quotas, SLAs |

Canonical copy: [`questions.json`](questions.json)

## Critical rule

**Jev must NOT compare version numbers or prices to reality.** Instructions ask only: "does this paragraph *assert* a specific value?" Verification is a separate LLM or human step.

## Scope

- One call per paragraph or short section (heading + body).
- State: `{ "path": "docs/api.md#auth", "content": "<paragraph text>" }`

## Compile pass

| path | question | noul | quoted_claim |

One row per noul ≥ 0.5. Extract the asserted claim text for later verification.

## Rules

1. HTTP-only; no doc rewrites in Jev.
2. Present claim inventory to user before editing docs.
3. Never treat Jev noul as proof of incorrectness — only proof of a **claim worth checking**.
