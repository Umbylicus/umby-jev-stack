# Umby Jev Stack — skill tree

This repo is a **skill tree**, not a one-off. Each skill lives in its own folder under `skills/`. Install the whole tree or grab one skill.

## Current skills

| # | Folder | Plugin name | What it does |
| --- | --- | --- | --- |
| 1 | `skills/umby-jev-review/` | `umby-jev-review` | Full repo review — six independent Nouls, executable defects only, `path`/`kind`/`chunk` in state, repo-sized HTTPS pool, compile every finding (v2.0.2) |
| 2 | `skills/umby-jev-diff-gate/` | `umby-jev-diff-gate` | Same hunt Nouls on git diff / PR patch only |
| 3 | `skills/umby-jev-secrets/` | `umby-jev-secrets` | Stricter secret + PII sweep (keys, tokens, passwords, emails, account IDs) |
| 4 | `skills/umby-jev-breaking-change/` | `umby-jev-breaking-change` | API / schema / export contract breaks |
| 5 | `skills/umby-jev-test-gap/` | `umby-jev-test-gap` | Behavior change without adequate tests |
| 6 | `skills/umby-jev-agent-safety/` | `umby-jev-agent-safety` | Destructive tool-call / command risk before execution |
| 7 | `skills/umby-jev-prompt-screen/` | `umby-jev-prompt-screen` | Jailbreak, secret-in-prompt, injection in user/issue text |
| 8 | `skills/umby-jev-issue-triage/` | `umby-jev-issue-triage` | Issue type Choice + urgency Score + independent security Noul |
| 9 | `skills/umby-jev-docs-drift/` | `umby-jev-docs-drift` | Flag version/price/API claims — LLM verifies later |
| 10 | `skills/umby-jev-browser/` | Jev Browse my site (`umby-jev-browser`) | Browser Harness/Chrome — indexed operation/target heads + independent error Nouls |
| 11 | `skills/umby-jev-speedy/` | Speedy Jev (`umby-jev-speedy`) | Incremental candidate index; four independent Nouls; ≥ 0.70 only; no deletions |

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

1. Create `skills/<skill-id>/` with `SKILL.md`, `questions.json` (when using Jev), and `.plugin/plugin.json`.
2. Add a marketplace entry in [`marketplace.json`](marketplace.json).
3. Document it in this file.
4. Bump the tree version in root [`plugin.json`](plugin.json).

The whole-tree plugin auto-discovers every immediate child of `skills/`.

## Shared requirements

- `JEV_API_KEY` from [console.typesafe.ai](https://console.typesafe.ai/) (exact name, case-sensitive)
- HTTP-first — `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`
- Independent Nouls per hunt — **never** a single highest-priority Choice that hides other hits
- Jev classifies only; confirm/compile agents never edit application code. Human reviews the full list and decides.

## Tree 1.6.1

- Browser display name set to **Jev Browse my site** in SKILL metadata, TREE, README, and marketplace. Folder/plugin id remains `umby-jev-browser`.

## Tree 1.6.0

- Speedy Jev 1.0.0 adds a local candidate index (path/hash/kind/last-seen), incremental scoring, and four independent Nouls. Only Speedy lists scores ≥ 0.70.
- Browser 2.0.0 follows jev-ultrafast: operation plus compatible speculative target heads in one request; text helper only for TYPE_TEXT; every error Noul ≥ 0.5 and click/type path are compiled.
- Diff-gate 2.0.0 ports review v2 structured hunts and ignore lists, scoped strictly to diff/PR changes.
- Review 2.0.2 clarifies look-only confirmation and the oversized-function chunk cap; Fable's six questions remain byte-for-byte unchanged. `state.content` ≤ 10,000 characters, repo-sized keep-alive HTTPS pool (concurrency = snippets), retry/backoff only as needed, and compile ≥ 0.5 remain intact.
- Siblings use structured instructions/criteria and explicit evidence boundaries. Issue-triage 2.0.0 corrects Score criteria to an ordered array and retains security independently of category.

All skills use `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`, and `JEV_API_KEY` (SDK examples may use `TYPESAFE_API_KEY`). No application fixes or automatic cleanup. MIT; owner Billy Lewis / Umbylicus.
