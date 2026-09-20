---
name: umby-jev-speedy
description: >-
  Speedy Jev finds stale comments, likely dead private code and concrete performance
  candidates using an incremental local candidate index and four independent Nouls.
  Lists only scores at least 0.70 for look-only cleanup proposals. Never patches or
  deletes application code. Requires JEV_API_KEY.
license: MIT
metadata:
  author: umby
  version: "1.0.0"
  display_name: Speedy Jev
  homepage: https://github.com/Umbylicus/umby-jev-stack
---

# Speedy Jev (skill 11)

Find clutter and slowness candidates for a later look-only cleanup proposal. This is a
skill specification, not a bundled executable runner. Jev classifies snippets; it does
not scrape a database, search a repository, delete code or apply fixes.

## Candidate index and incremental runner

1. Enumerate only the requested repository scope locally. Maintain a SQLite index or
   simple table outside tracked application files: `path`, `hash`, `kind`, `last_seen`,
   plus candidate identity/range, context hash, question version, status and cached scores.
   Store hashes and references, not credentials. Exclude generated/vendor/build output.
2. Build candidates from comments-heavy chunks, TODO/FIXME, commented-out/debug residue,
   unused-looking exports and obvious request/hot-path patterns. These are search hints,
   not findings. Exclude public exports/APIs before scoring; only demonstrably internal
   exports can remain. Apply every hard ignore below before submitting any candidate.
3. Refresh last-seen for every observed candidate. Skip unchanged hashes only when a
   successful result exists for the same question version and relevant context hash.
   Changes to references/imports/call sites invalidate dependent candidates even when
   their own text is unchanged. Retire deleted/no-longer-eligible candidates and their
   cached rows. Reuse eligible cached scores in the current compile; never show stale rows.
4. Each snippet carries `path`, `kind`, `language`, `chunk`/original line range, `content`,
   candidate reason and reference/hot-path evidence. `state.content` ≤ 10,000 characters;
   split at coherent boundaries and retain context. Incomplete reference evidence cannot
   establish deadness or safety. A performance observation never establishes removability.
5. Let `N` be candidate count (or remaining uncached count). Set **concurrency = N** and
   send one HTTPS wave using a keep-alive pool sized to N: 50 candidates → 50 in-flight
   POSTs; 250 → 250. These are Jev HTTP calls, not agents. N=0 means no request.
   Retry EAGAIN/EMFILE/ECONNRESET/timeouts/429 with backoff (honor Retry-After); reduce only
   as needed after repeated pressure. Bound retries and report unresolved items as
   incomplete; failed calls never become successful cache entries. Split oversized
   requests further and retry rather than silently dropping candidates.

## Independent questions

Load all four structured Nouls from [questions.json](questions.json) in every request:
`is_stale_comment`, `is_likely_dead_code`, `is_perf_smell`, `is_safe_to_remove`.
Use [TypeSafe Advanced: structure](https://docs.typesafe.ai/primitives/advanced).
Never collapse these into one Choice or use the removal score to suppress other hits.

HTTP-first: `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`,
`Authorization: Bearer $JEV_API_KEY`, `Content-Type: application/json`.
Body: `{ "model": "jev-latest", "state": <snippet object>, "questions": <questions.json> }`.
SDK examples may say TYPESAFE_API_KEY; this tree uses JEV_API_KEY. Do not log credentials.
Validate all four `answers.<key>.noul` values as finite numbers in [0,1]; retain returned
model and exact scores. Missing/malformed answers are incomplete work, not clean results.

## Hard ignores

Public APIs, migrations, auth, parameterized SQL, tests/fixtures, comments that document
contracts, and anything that would change runtime behavior if removed blindly are
excluded from cleanup/removal candidates. Preserve licenses and safety explanations.
For performance, report only an investigation of the observed pattern, never removal
of runtime work. If a candidate cannot be separated from a protected region, skip it.

## Compile and documented follow-up (not automatic)

**Listing rule: noul ≥ 0.70 only.** Drop rows below 0.70 from the compiled list and from
follow-up input. This bar belongs only to Speedy Jev; review, diff-gate and browser stay
at ≥ 0.5. Keep every independent qualifying row, including multiple rows per snippet.

| path | kind | lines | question | noul | model | evidence | proposed cleanup | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Quote re-read evidence or mark `unlocated`; do not guess a line from keywords. Report
indexed, skipped, submitted, cached and failed counts without flooding the list with
subthreshold rows. An empty list is not a clean bill of health for the whole repository.

A later follow-up agent receives **only the ≥ 0.70 list** as its work queue. It may read
referenced source and dependencies to confirm each listed candidate, explain how an
item could be fixed or deleted, and write that proposal into the same compile. Mark
uncertain or rejected rows explicitly; preserve every qualifying row. It must not apply
fixes, delete code, run rewrites or change application files. `is_safe_to_remove` is a
classification, never deletion authorization. A human reviews the full compile and decides.
