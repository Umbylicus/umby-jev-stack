# Umby Jev Stack — skill tree

This repo is a **skill tree**, not a one-off. Each skill lives in its own folder under `skills/`. Install the whole tree or grab one skill.

## Current skills

| # | Folder | Plugin name | What it does |
| --- | --- | --- | --- |
| 1 | `skills/umby-jev-review/` | `umby-jev-review` | Full repo review — six independent Nouls, executable defects only, `path`/`kind`/`chunk` in state, compile every finding (v2.0) |
| 2 | `skills/umby-jev-diff-gate/` | `umby-jev-diff-gate` | Same hunt Nouls on git diff / PR patch only |
| 3 | `skills/umby-jev-secrets/` | `umby-jev-secrets` | Stricter secret + PII sweep (keys, tokens, passwords, emails, account IDs) |
| 4 | `skills/umby-jev-breaking-change/` | `umby-jev-breaking-change` | API / schema / export contract breaks |
| 5 | `skills/umby-jev-test-gap/` | `umby-jev-test-gap` | Behavior change without adequate tests |
| 6 | `skills/umby-jev-agent-safety/` | `umby-jev-agent-safety` | Destructive tool-call / command risk before execution |
| 7 | `skills/umby-jev-prompt-screen/` | `umby-jev-prompt-screen` | Jailbreak, secret-in-prompt, injection in user/issue text |
| 8 | `skills/umby-jev-issue-triage/` | `umby-jev-issue-triage` | Issue type Choice + urgency Score (independent dimensions) |
| 9 | `skills/umby-jev-docs-drift/` | `umby-jev-docs-drift` | Flag version/price/API claims — LLM verifies later |
| 10 | `skills/umby-jev-browser/` | `umby-jev-browser` | Jev-driven browser loop — thin driver, error Nouls + Choice next_action |

Add new skills as siblings under `skills/`.

## Install the whole tree

```bash
npx plugins add Umbylicus/umby-jev-stack --target cursor
```

Select **`umby-jev-stack`** when prompted (installs every skill in `skills/`).

## Install one skill

```bash
npx plugins add Umbylicus/umby-jev-stack --target cursor
```

Select the skill name when prompted (e.g. **`umby-jev-secrets`**).

**Manual copy:**

```bash
cp -r skills/umby-jev-review/ ~/.cursor/skills/umby-jev-review/
```

## Add a new skill

1. Create `skills/<skill-id>/` with `SKILL.md` and `questions.json`.
2. Add a marketplace entry in [`marketplace.json`](marketplace.json).
3. Document it in this file.
4. Bump the tree version in root [`plugin.json`](plugin.json).

The whole-tree plugin auto-discovers every immediate child of `skills/`.

## Shared requirements

- `JEV_API_KEY` from [console.typesafe.ai](https://console.typesafe.ai/) (exact name, case-sensitive)
- HTTP-first — `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`
- Independent Nouls per hunt — **never** a single highest-priority Choice that hides other hits
- Jev classifies only; user reviews compiled findings before fixes
