#!/usr/bin/env node
"use strict";

import path from "node:path";
import { fileURLToPath } from "node:url";
import { runLinkInventory } from "./lib.mjs";
import { startFixtureServer } from "./fixture.mjs";

function usage() {
  return `Jev Link my site — look-only internal-link inventory

Usage:
  node link.mjs --url https://example.com [--out dir] [--dry-run] [--max-pages 500]
  node link.mjs --fixture [--out dir] [--dry-run]

--dry-run / --fixture use a stub scorer and do not need JEV_API_KEY.
JEV_API_KEY is read only from the environment. Never pass a key on the CLI.
`;
}

function parseArgs(argv) {
  const args = { dryRun: false, fixture: false, maxPages: 500, outDir: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") args.help = true;
    else if (token === "--dry-run") args.dryRun = true;
    else if (token === "--fixture") args.fixture = true;
    else if (token === "--url") args.url = argv[++i];
    else if (token === "--out") args.outDir = argv[++i];
    else if (token === "--max-pages") args.maxPages = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function envKeyPresent() {
  return Boolean(process.env.JEV_API_KEY && String(process.env.JEV_API_KEY).trim());
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  let fixture = null;
  let url = args.url;
  if (args.fixture) {
    fixture = await startFixtureServer();
    url = fixture.url;
    args.dryRun = true;
  }
  if (!url) {
    process.stderr.write(usage());
    return 1;
  }

  const hasKey = envKeyPresent();
  if (!args.dryRun && !hasKey) {
    process.stderr.write("JEV_API_KEY is not set. Use --dry-run / --fixture or export the key.\n");
    if (fixture) await fixture.close();
    return 1;
  }

  const outDir = args.outDir
    ? path.resolve(args.outDir)
    : path.join(process.cwd(), "out");

  try {
    const result = await runLinkInventory({
      url,
      outDir,
      dryRun: args.dryRun,
      apiKey: hasKey ? process.env.JEV_API_KEY : "",
      maxPages: Number.isFinite(args.maxPages) && args.maxPages > 0 ? args.maxPages : 500
    });
    process.stdout.write(
      [
        "Jev Link my site",
        `url: ${result.startUrl}`,
        `discovery: ${result.discovery}`,
        `pages discovered: ${result.discoveredCount}`,
        `indexable: ${result.indexableCount}`,
        `passages scored: ${result.jobs}`,
        `mode: ${result.mode}`,
        `suggestions (>= 0.70): ${result.suggestions.length}`,
        result.files
          ? `wrote: ${result.files.csvPath} ${result.files.jsonPath} ${result.files.mdPath}`
          : "wrote: (no --out)"
      ].join("\n") + "\n"
    );
    return 0;
  } finally {
    if (fixture) await fixture.close();
  }
}

const entry = process.argv[1] && path.resolve(process.argv[1]);
const self = fileURLToPath(import.meta.url);
if (entry && self && entry === self) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

export { main, parseArgs, usage };
