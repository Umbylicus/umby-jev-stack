---
name: umby-jev-breaking-change
description: >-
  Skill 4 of Umby Jev Stack. Detect API, schema, and export contract breaks via independent
  Nouls (removed exports, renamed fields, type changes, required fields, endpoints, enums).
  Compile every hit. HTTP-first. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.0.0"
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-breaking-change
---

# Umby Jev Breaking Change (skill 4)

Part of the [Umby Jev Stack](https://github.com/Umbylicus/umby-jev-stack) skill tree. Flag **API, schema, and export contract breaks** with independent Nouls — ideal for semver and changelog gates.

## Hunt Nouls

| Question | Detects |
| --- | --- |
| `has_removed_export` | Removed public symbol |
| `has_renamed_field` | Renamed public field / JSON key |
| `has_type_change` | Breaking type or format change |
| `has_new_required_field` | New required field or parameter |
| `has_endpoint_change` | Removed/renamed HTTP route or method |
| `has_enum_break` | Removed/renamed enum or union value |

Canonical copy: [`questions.json`](questions.json)

## Scope

- Prefer diff/patch state when reviewing PRs; whole file OK for schema definitions.
- Include related type/interface/schema context in state when needed.

## Compile pass

One row per noul ≥ 0.5. A single change can break multiple contracts — list them all.

## Rules

1. HTTP-only Jev; no fixes in instructions.
2. Present compiled break list before version bumps or release notes.
3. Agent confirms each flag; Jev can misfire on intentional breaking changes.
