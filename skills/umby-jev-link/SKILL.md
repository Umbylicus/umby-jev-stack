---
name: umby-jev-link
description: >-
  Jev Link my site finds internal-link opportunities on a live small-business
  site. Use when the user says Jev Link my site, or asks for SEO internal
  links, contextual links, or a link inventory. Sitemap first, same-host crawl
  fallback, 500-page cap. Jev picks one target from a shortlist plus no_link.
  Lists only confidence ≥ 0.70. Anchor text is chosen outside Jev. Writes
  CSV, JSON, and implement-as-PR notes. Never edits the site. Requires
  JEV_API_KEY unless --dry-run.
license: MIT
metadata:
  author: umby
  version: "1.0.0"
  display_name: Jev Link my site
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-link
  openclaw:
    primaryEnv: JEV_API_KEY
    requires:
      env:
        - JEV_API_KEY
    envVars:
      - name: JEV_API_KEY
        required: true
        description: TypeSafe Jev API key from console.typesafe.ai/settings/keys
---

# Jev Link my site (skill 14)

Look-only internal-link inventory for a live site. The runner never edits the
site, the client repo, or application code. Jev only picks a destination from
a bounded shortlist. A later coding agent may add **human-approved** links as
a PR; a human reviews and merges.

Load [questions.json](questions.json). Do not reword the frozen Choice. Candidate
ids are filled at runtime the same way Browse fills empty target `criteria`.

## Pipeline

1. **Input** — one live site URL (or `--fixture` for the bundled local HTML site).
2. **Discover** — robots.txt `Sitemap:` lines, then `/sitemap.xml`, then sitemap
   indexes. Same-host crawl fallback if no sitemap URLs. Cap **500** pages.
3. **Keep** only indexable canonical HTML: drop redirects, 4xx/5xx, `noindex`,
   canonical-elsewhere, non-HTML, and duplicate URLs.
4. **Extract** per page: title, headings, paragraph-level passages (heading path
   + paragraph index), and existing same-host links.
5. **Retrieve** a small shortlist per passage with lexical TF-IDF overlap against
   target titles and headings. Remove self, already-linked source-target pairs,
   and ineligible targets (non-indexable, legal/utility).
6. **Ask Jev** one frozen Choice, `best_internal_link_target`, with the offered
   candidate ids plus `no_link`. `POST https://api.typesafe.ai/v1/systemone`,
   model `jev-latest`, `Authorization: Bearer $JEV_API_KEY`. Store `choice`,
   per-option `probabilities`, and `confidence`.
7. **Keep** suggestions with confidence **≥ 0.70** whose choice is not `no_link`.
8. **Anchor** — chosen outside Jev (the passage phrase that best matches the
   target title/headings). Jev does not write copy.
9. **Write** CSV + JSON + `IMPLEMENT.md` telling a coding agent how to add
   approved links in the site repo as a PR. Do not merge.

`--dry-run` and `--fixture` use a local stub scorer and need no key.

```bash
node skills/umby-jev-link/link.mjs --url https://example.com --out ./out
node skills/umby-jev-link/link.mjs --fixture --dry-run --out ./out
node --test skills/umby-jev-link/test/*.test.mjs
```

HTTP-first: body `{ "model": "jev-latest", "state": <passage + candidates>, "questions": <populated questions.json> }`.
This tree uses `JEV_API_KEY`; SDK examples may use `TYPESAFE_API_KEY`. Never print
the key. Do not commit `.env` files or crawl outputs.

Respectful crawl: identifiable User-Agent, concurrency 4, 10s timeouts. Jev
calls are separate and use a small pool. The skill is look-only — confirm/compile
agents must not patch the site.
