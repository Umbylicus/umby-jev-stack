# Umby's Jev Stack

Portable agent skill that teaches Cursor, Claude Code, Codex, and similar coding agents to run [TypeSafe Jev](https://typesafe.ai/) as a **cheap classifier** over HTTP (`api.typesafe.ai`), with an optional community [jev-review MCP](https://github.com/NiazMorshed2007/jev-review) for richer continuous review.

This repo is small and honest: **not every unnamed chat product will load it automatically.** Install it where your agent reads skills or plugins.

## What it does

- Sends focused file or diff context to Jev with **frozen review labels** (see skill).
- Hunts syntax/type errors, secrets, injection, XSS, auth issues, schema breaks, and logic bugs.
- **Never hallucinates fixes inside Jev** — Jev classifies; the coding agent confirms flags.
- Compiles every non-clean finding; **never drops a finding**.
- Fixes happen **only after the user reviews** the compiled report.

## Requirements

- A Jev API key from the [TypeSafe console](https://console.typesafe.ai/settings/keys)
- `curl`, `fetch`, or any HTTP client (no Cursor-only tools required)
- Optional: Node.js 20+ if you add [jev-review](https://github.com/NiazMorshed2007/jev-review) MCP separately

## API key

Export your key in the shell (name used by this skill and jev-review):

```bash
export JEV_API_KEY="your-key-here"
```

Get a key at [console.typesafe.ai/settings/keys](https://console.typesafe.ai/settings/keys). **Do not commit keys, tokens, or `.env` files.**

### Cloud agents

Cursor Cloud Agents and similar remote VMs need **`JEV_API_KEY` as a Runtime Secret** (or equivalent platform env var). Desktop MCP config from your laptop does **not** auto-appear on cloud VMs — set the secret in the cloud agent environment.

## Install

### Cursor (plugin)

```bash
npx plugins add Umbylicus/umby-jev-stack --target cursor
```

Restart Cursor. Invoke the `umby-jev-stack` skill when you want a Jev pass on changed files.

**Manual copy:** clone this repo and copy `skills/umby-jev-stack/` into `.cursor/skills/` (project) or `~/.cursor/skills/` (user).

### Claude Code

```bash
npx plugins add Umbylicus/umby-jev-stack --target claude-code
```

Or copy `skills/umby-jev-stack/SKILL.md` into your project's `.claude/skills/` tree.

### Codex

```bash
npx plugins add Umbylicus/umby-jev-stack --target codex
```

Or copy the skill folder into the skills path your Codex setup documents.

### Other agents

Copy `skills/umby-jev-stack/SKILL.md` (and references if you add any) into whatever skills directory your product uses. The workflow is plain HTTP + shell — no vendor lock-in.

## Optional: jev-review MCP

For **continuous, dimension-scored review** (correctness, security, complexity, tests, etc.), install the community MCP separately — we do **not** vendor it:

```bash
npx plugins add NiazMorshed2007/jev-review
```

Docs: [github.com/NiazMorshed2007/jev-review](https://github.com/NiazMorshed2007/jev-review)

Umby Jev Stack and jev-review complement each other:

| | Umby Jev Stack (this repo) | jev-review MCP |
| --- | --- | --- |
| Transport | HTTP `POST /v1/systemone` | Local MCP stdio |
| Output | Frozen pass/fail labels per file | Multi-dimension 1–10 scores |
| Best for | Cheap parallel file sweep + compile | Iterative quality loop while coding |

## Workflow (summary)

1. Agent gathers changed or requested files (path + content, or a focused diff).
2. **Parallel** Jev calls — one state per file or coherent chunk (respect token limits).
3. **One compile pass** — merge all answers into a single findings table; include confidence and model version from each response.
4. Present compiled findings to the user. **Do not fix yet.**
5. After user review, agent may confirm each flag and apply fixes the user approves.

See [`skills/umby-jev-stack/SKILL.md`](skills/umby-jev-stack/SKILL.md) for frozen questions, HTTP examples, and agent rules.

## Direct HTTP example

```bash
curl -s https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $JEV_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "model": "jev-latest",
  "state": {
    "path": "src/auth.ts",
    "content": "const token = 'sk-live-hardcoded';"
  },
  "questions": {
    "review_label": {
      "type": "choice",
      "instructions": "Pick the single highest-priority label for this code snippet.",
      "criteria": {
        "Clean_Codebase": "No syntax/type errors, security issues, schema mismatches, or logic bugs worth flagging",
        "Syntax_Or_Type_Error": "Syntax, parse, or type error; missing import; invalid reference; code would not compile or typecheck",
        "Vulnerability_Flagged": "Hardcoded secret, injection, XSS, auth bypass, unsafe eval, or similar security flaw",
        "Schema_Mismatch": "API or schema contract break: wrong fields, missing required keys, incompatible types vs declared schema"
      }
    }
  }
}
EOF
```

## License

MIT — see [LICENSE](LICENSE).
