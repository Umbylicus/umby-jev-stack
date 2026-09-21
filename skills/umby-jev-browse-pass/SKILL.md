---
name: umby-jev-browse-pass
description: >-
  After a feature lands in the current work tree, start the local dev server
  and have Jev click through only what was added. Use when the user says
  Jev browse pass, or asks to test a new update, calendar, form, page, or
  any other feature just added to this project. Chrome, indexed controls,
  fake data for new records. End with candidates, numbered real issues, and
  a matching numbered fix. No application patches. Never production.
license: MIT
metadata:
  author: umby
  version: "1.0.0"
  display_name: Jev browse pass
  homepage: https://github.com/Umbylicus/umby-jev-stack
  source: https://github.com/Umbylicus/umby-jev-stack/tree/main/skills/umby-jev-browse-pass
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

# Jev browse pass

Variant of [Jev Browse my site](../umby-jev-browser/SKILL.md). The agent reads what was just added, starts the local app, and directs Jev to click through that new work. Jev still picks each click. The agent picks the goal.

Use it at the end of a change: a calendar, a form, a page, a setting, or anything else added to the current work tree.

## What to test

1. Read the current work tree. Use the uncommitted diff and the commits that are not on the base branch yet. Name the screens, controls, and routes that change introduces. If the user names the feature, test that.
2. Test only the added feature. Do not tour the rest of the app. If the diff has no user-facing surface, say so and stop.
3. For a calendar, open it and add an event with fake data. For any other feature, click every control that feature added, including create and save when the feature creates a record. Use obvious fake values. Do not send, charge, publish, or change DNS on a real account.

## Local server

Start the project’s own dev server on `127.0.0.1` when it is not already running. Read the repo’s dev script (`wrangler`, `vite`, `next`, or the `dev` script in `package.json`). If a server for this work tree is already up, use it.

Stop if the only URL is production or a live customer workspace. Stop the server when this pass started it.

## Direct Jev

Follow the observe, decide, and execute loop in Jev Browse my site: Chrome, snapshot indexes, one Jev request, one action, nouls from `answers.<name>.noul`. Load [questions.json](questions.json).

Give Jev one goal for the new feature: open it, click each of its controls once, fill empty fields with the fake values already in the task, and save when the feature is supposed to save. Do not click Close or Cancel before that save.

A value already in the task is typed immediately. Do not retype a filled field. One rejection marks that control tried. Desktop touch-off must not send a touch-point count of 0.

## Report

End the same way as Jev Browse my site. Do not patch the application.

```
Candidates
- …

Real issues
1. …

Fix
1. …
```

Number Fix so 1 matches real issue 1. Each fix is one line about what needs to be done, not a code edit. If none are real, write None under both headings.
