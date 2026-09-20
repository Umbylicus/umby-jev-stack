# Umby Jev Stack — skill tree

This repo is a **skill tree**, not a one-off. Each skill lives in its own folder under `skills/`. Install the whole tree or grab one skill.

## Current skills

| # | Folder | Plugin name | What it does |
| --- | --- | --- | --- |
| 1 | `skills/umby-jev-review/` | `umby-jev-review` | Full Jev review — independent Nouls per hunt, HTTP `POST /v1/systemone`, compile every finding |

More skills will be added as siblings under `skills/`.

## Install the whole tree

```bash
npx plugins add Umbylicus/umby-jev-stack --target cursor
```

Select **`umby-jev-stack`** when prompted (installs every skill in `skills/`).

Or copy the repo and place all of `skills/*/` into your agent's skills directory.

## Install one skill

**Plugin (named):**

```bash
npx plugins add Umbylicus/umby-jev-stack --target cursor
```

Select **`umby-jev-review`** when prompted.

**Manual copy:**

```bash
cp -r skills/umby-jev-review/ ~/.cursor/skills/umby-jev-review/
```

## Add a new skill

1. Create `skills/<skill-id>/` with `SKILL.md` (+ any assets like `questions.json`).
2. Add a marketplace entry in [`marketplace.json`](marketplace.json):

   ```json
   {
     "name": "<skill-id>",
     "description": "…",
     "version": "1.0.0",
     "source": "./skills/<skill-id>"
   }
   ```

3. Document it in this file.
4. Bump the tree version in root [`plugin.json`](plugin.json).

The whole-tree plugin (`umby-jev-stack`) auto-discovers every immediate child of `skills/` — no explicit list update needed.

## Shared requirements

- `JEV_API_KEY` from [console.typesafe.ai](https://console.typesafe.ai/) (exact name, case-sensitive)
- HTTP-first — no MCP required
- Independent Nouls only — never a single highest-priority Choice
