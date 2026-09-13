#!/usr/bin/env node
/**
 * build-gmail-memory.mjs
 * Rebuilds docs/data/gmail-memory.json from the live TIMPS Gmail store
 * (~/.timps/gmail/summaries.jsonl + state.json). Run after each sync:
 *
 *   node docs/tools/build-gmail-memory.mjs
 *
 * Only distilled, schema-shaped email facts are exported — never tokens or
 * credential files.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gmailRoot = process.env.GMAIL_ROOT || join(homedir(), '.timps', 'gmail');
const outDir = join(here, '..', 'data');

const summariesPath = join(gmailRoot, 'summaries.jsonl');
const statePath = join(gmailRoot, 'state.json');
const outPath = join(outDir, 'gmail-memory.json');

let state = {};
try {
  state = JSON.parse(readFileSync(statePath, 'utf8'));
} catch {
  /* state is optional */
}

const emails = [];
try {
  const raw = readFileSync(summariesPath, 'utf8');
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      emails.push(JSON.parse(s));
    } catch {
      /* skip malformed line */
    }
  }
} catch {
  /* no store yet — empty dataset */
}

emails.sort((a, b) => Date.parse(b.syncedAt || b.date || 0) - Date.parse(a.syncedAt || a.date || 0));

const payload = {
  generatedAt: new Date().toISOString(),
  source: '~/.timps/gmail',
  store: {
    lastRun: state.lastRun || null,
    messagesSynced: state.messagesSynced ?? 0,
    summaryCount: emails.length,
    totalFacts: emails.reduce((n, e) => n + (Array.isArray(e.facts) ? e.facts.length : 0), 0),
  },
  emails,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`wrote ${outPath}`);
console.log(`  summaryCount=${payload.store.summaryCount} facts=${payload.store.totalFacts} lastRun=${payload.store.lastRun}`);