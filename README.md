# Umby's Jev Stack

Add Umby's Jev review to any repo in minutes. [TypeSafe Jev](https://typesafe.ai/) classifies code over HTTP — no community MCP required.

**Repo:** https://github.com/Umbylicus/umby-jev-stack

## Quick start (4 steps)

1. **Get a key** — [console.typesafe.ai](https://console.typesafe.ai/) → create a TypeSafe API key.
2. **Install this skill** — see [Install](#install) below.
3. **Set `JEV_API_KEY`** — exact name, case-sensitive. See [API key](#api-key-jev_api_key).
4. **Prompt your agent:**

   > Run Umby's Jev Stack on this repo. Use the frozen questions in the skill. Compile every finding. Do not drop any.

## What it does

- Fans out **one HTTP call per file/snippet** with **independent Noul questions** per hunt (syntax, secrets, injection/XSS, auth, schema, logic).
- **Every positive flag gets a row** in the compiled report — never "pick the most important one."
- Frozen compile labels: `Clean_Codebase`, `Syntax_Or_Type_Error`, `Vulnerability_Flagged`, `Schema_Mismatch` (plus logic findings).
- Jev classifies only; the coding agent compiles and confirms — **no fixes until you review**.

This stack is **HTTP-first**. The [jev-review MCP](https://github.com/NiazMorshed2007/jev-review) is **optional** and not required.

## API key (`JEV_API_KEY`)

Get a key at [console.typesafe.ai](https://console.typesafe.ai/). **Do not commit keys.**

| Where | How |
| --- | --- |
| **Shell** | `export JEV_API_KEY="your-key"` |
| **Cursor desktop** | Cursor Settings → MCP / plugin environment, **or** `export` in shell then `launchctl setenv JEV_API_KEY "$JEV_API_KEY"` and fully quit/reopen Cursor from the Dock (Dock apps don't inherit terminal exports). |
| **Cursor cloud agents** | **Runtime Secret** named exactly `JEV_API_KEY` — not Environment Variable, not Build Secret, not `Jev_API_KEY`. |

Verify without printing the key: `test -n "$JEV_API_KEY" && echo ok`

## Install

### Cursor

```bash
npx plugins add Umbylicus/umby-jev-stack --target cursor
```

Restart Cursor (or Reload Window). Set `JEV_API_KEY` as above.

**Manual:** copy `skills/umby-jev-stack/` to `.cursor/skills/` (project) or `~/.cursor/skills/` (user).

### Claude Code

```bash
npx plugins add Umbylicus/umby-jev-stack --target claude-code
```

Then `export JEV_API_KEY` in the shell that launches Claude Code.

### Codex

```bash
npx plugins add Umbylicus/umby-jev-stack --target codex
```

Then `export JEV_API_KEY` in the shell that launches Codex.

## Workflow

1. Agent gathers files (path + content, or focused diff).
2. **Parallel** Jev calls — one per file/chunk, full question set each time (`POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`).
3. **One compile pass** — expand every noul ≥ 0.5 into its own row; multiple rows per file when needed.
4. You review the compiled report. Agent does **not** fix yet.
5. After approval, agent confirms flags and fixes one file at a time.

Full skill: [`skills/umby-jev-stack/SKILL.md`](skills/umby-jev-stack/SKILL.md) · frozen questions: [`skills/umby-jev-stack/questions.json`](skills/umby-jev-stack/questions.json)

## Optional: jev-review MCP

For continuous multi-dimension scoring while coding (not bundled):

```bash
npx plugins add NiazMorshed2007/jev-review
```

https://github.com/NiazMorshed2007/jev-review

| | Umby Jev Stack | jev-review MCP |
| --- | --- | --- |
| Required? | **No MCP** — HTTP only | Optional add-on |
| Transport | `POST /v1/systemone` | Local MCP stdio |
| Output | Independent Noul flags per hunt | Multi-dimension 1–10 scores |

## Direct HTTP example

```bash
curl -s https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $JEV_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg path 'src/auth.ts' \
    --arg content \"const token = 'sk-live-hardcoded';\" \
    --slurpfile q skills/umby-jev-stack/questions.json \
    '{model:\"jev-latest\",state:{path:$path,content:$content},questions:$q[0]}')"
```

## License

MIT — see [LICENSE](LICENSE).
