# Umby's Jev Stack

A **skill tree** of [TypeSafe Jev](https://typesafe.ai/) agent skills over HTTP. Install the whole tree or grab one skill.

**Repo:** https://github.com/Umbylicus/umby-jev-stack · **Tree index:** [`TREE.md`](TREE.md)

## Quick start (4 steps)

1. **Get a key** — [console.typesafe.ai](https://console.typesafe.ai/) → create a TypeSafe API key.
2. **Install** — whole tree or one skill (see [Install](#install)).
3. **Set `JEV_API_KEY`** — exact name, case-sensitive. See [API key](#api-key-jev_api_key).
4. **Prompt your agent:**

   > Run Umby's Jev Stack on this repo. Use the frozen questions in the skill. Compile every finding. Do not drop any.

## Skill tree

| # | Skill | Folder |
| --- | --- | --- |
| 1 | **umby-jev-review** — full repo review | `skills/umby-jev-review/` |

Add new skills as siblings under `skills/`. See [`TREE.md`](TREE.md).

## Install

### Whole tree (all skills)

```bash
npx plugins add Umbylicus/umby-jev-stack --target cursor
```

Select **`umby-jev-stack`** when prompted. Also works with `--target claude-code` or `--target codex`.

**Manual:** copy every folder under `skills/` into your agent's skills directory.

### One skill only

```bash
npx plugins add Umbylicus/umby-jev-stack --target cursor
```

Select **`umby-jev-review`** when prompted.

**Manual:**

```bash
cp -r skills/umby-jev-review/ ~/.cursor/skills/umby-jev-review/
```

## API key (`JEV_API_KEY`)

Get a key at [console.typesafe.ai](https://console.typesafe.ai/). **Do not commit keys.**

| Where | How |
| --- | --- |
| **Shell** | `export JEV_API_KEY="your-key"` |
| **Cursor desktop** | Cursor Settings → MCP / plugin environment, **or** `export` in shell then `launchctl setenv JEV_API_KEY "$JEV_API_KEY"` and fully quit/reopen Cursor from the Dock (Dock apps don't inherit terminal exports). |
| **Cursor cloud agents** | **Runtime Secret** named exactly `JEV_API_KEY` — not Environment Variable, not Build Secret, not `Jev_API_KEY`. |

Verify without printing the key: `test -n "$JEV_API_KEY" && echo ok`

## What skill 1 does (umby-jev-review)

- Fans out **one HTTP call per file/snippet** with **independent Noul questions** per hunt (syntax, secrets, injection/XSS, auth, schema, logic).
- **Every positive flag gets a row** — never "pick the most important one."
- Frozen compile labels: `Clean_Codebase`, `Syntax_Or_Type_Error`, `Vulnerability_Flagged`, `Schema_Mismatch` (plus logic findings).
- Jev classifies only; the coding agent compiles and confirms — **no fixes until you review**.

This stack is **HTTP-first**. The [jev-review MCP](https://github.com/NiazMorshed2007/jev-review) is **optional** and not required.

## Workflow (skill 1)

1. Agent gathers files (path + content, or focused diff).
2. **Parallel** Jev calls — one per file/chunk, full question set (`POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`).
3. **One compile pass** — expand every noul ≥ 0.5 into its own row; multiple rows per file when needed.
4. You review the compiled report. Agent does **not** fix yet.
5. After approval, agent confirms flags and fixes one file at a time.

Full skill: [`skills/umby-jev-review/SKILL.md`](skills/umby-jev-review/SKILL.md) · questions: [`skills/umby-jev-review/questions.json`](skills/umby-jev-review/questions.json)

## Optional: jev-review MCP

For continuous multi-dimension scoring while coding (not bundled):

```bash
npx plugins add NiazMorshed2007/jev-review
```

https://github.com/NiazMorshed2007/jev-review

## License

MIT — see [LICENSE](LICENSE).
