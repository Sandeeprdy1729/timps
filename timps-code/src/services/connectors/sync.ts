// ── TIMPS Connectors — generic sync pipeline ──
// runConnectorSync(id) is the shared implementation behind every
// `<id>:sync` CLI command (and therefore the desktop Sync buttons, which shell
// out to `node .../dist/bin/timps.js <id>:sync`).
//
// Pipeline: ensure token → fetch recent items → raw-store + summarize →
// distill 1-2 facts per item into TIMPS memory → update state.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Memory } from '../../memory/memory.js';
import { connectorDef } from './registry.js';
import {
  ensureAccessToken,
  enstateDir,
  loadState,
  rawDir,
  saveState,
  summariesFile,
} from './tokens.js';
import {
  fetchCalendarRecent,
  fetchDriveRecent,
  fetchGithubRecent,
  fetchLinearRecent,
  fetchMs365Recent,
  fetchNotionRecent,
  fetchSlackRecent,
  type ConnectorItem,
} from './clients.js';

export interface ConnectorSyncOptions {
  maxItems?: number;
  /** Default true; false skips writing distilled facts into memory. */
  storeMemory?: boolean;
}

export interface ConnectorSyncResult {
  connectedAs: string;
  fetched: number;
  stored: number;
  skippedExisting: number;
  factsStored: number;
}

export function fetchRecentItems(id: string, token: string, maxItems: number): Promise<ConnectorItem[]> {
  const fetchers: Record<string, (t: string, n: number) => Promise<ConnectorItem[]>> = {
    calendar: fetchCalendarRecent,
    drive: fetchDriveRecent,
    github: fetchGithubRecent,
    notion: fetchNotionRecent,
    slack: fetchSlackRecent,
    linear: fetchLinearRecent,
    ms365: fetchMs365Recent,
  };
  const fetchFn = fetchers[id];
  if (!fetchFn) throw new Error(`No sync implementation for connector: ${id}`);
  return fetchFn(token, maxItems);
}

export function itemFact(id: string, item: ConnectorItem): { fact: string; tags: string[] } {
  const tags = ['connector', 'knowledge'];
  tags.push(id);
  const date = item.when ? new Date(item.when).toISOString().slice(0, 10) : 'recently';

  switch (id) {
    case 'calendar':
      tags.push('calendar', 'event');
      return {
        fact: `${item.who ? `Meeting with ${item.who.split(', ').slice(0, 3).join(', ')}` : 'Calendar event'}: ${item.title}`,
        tags,
      };
    case 'drive':
      tags.push('drive', 'file');
      return { fact: `Drive file (${item.meta.mimeType ?? 'document'}): ${item.title}`, tags };
    case 'github': {
      tags.push('github');
      if (item.meta.repo) tags.push(`repo:${item.meta.repo}`);
      const kind = item.meta.kind === 'pull_request' ? 'PR' : 'issue';
      return {
        fact: `${item.meta.repo} ${kind} #${item.meta.number} [${item.meta.state}]: ${item.title}`,
        tags,
      };
    }
    case 'notion':
      tags.push('notion', 'page');
      return { fact: `Notion page: ${item.title}`, tags };
    case 'slack':
      tags.push('slack');
      return { fact: `Slack (${item.meta.channel ?? ''}): ${item.title}`, tags };
    case 'linear': {
      tags.push('linear');
      if (item.meta.project) tags.push(`project:${item.meta.project}`);
      return {
        fact: `Linear ${item.meta.identifier ?? 'issue'} [${item.meta.state}]: ${item.title}`,
        tags,
      };
    }
    case 'ms365':
      tags.push('ms365');
      if (item.meta.kind === 'mail') {
        tags.push('mail');
        return { fact: `Email from ${item.who ?? 'unknown'}: ${item.title}`, tags };
      }
      tags.push('calendar', 'event');
      return { fact: `Calendar (${date}): ${item.title}`, tags };
    default:
      return { fact: item.title, tags };
  }
}

function safeFilePart(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export async function runConnectorSync(
  id: string,
  opts: ConnectorSyncOptions = {},
): Promise<ConnectorSyncResult> {
  const def = connectorDef(id);
  if (!def) throw new Error(`Unknown connector: ${id}`);

  const token = await ensureAccessToken(id);
  const maxItems = Math.min(opts.maxItems ?? def.maxItems, 100);

  const items = await fetchRecentItems(id, token, maxItems);

  enstateDir(id);
  const rawBase = rawDir(id);
  const slice = new Date().toISOString().slice(0, 10);
  const sliceDir = path.join(rawBase, slice);
  fs.mkdirSync(sliceDir, { recursive: true });

  const memory = new Memory(os.homedir());
  const summaries = summariesFile(id);

  let stored = 0;
  let skippedExisting = 0;
  let factsStored = 0;

  for (const item of items) {
    const rawPath = path.join(sliceDir, `${safeFilePart(item.id)}.json`);
    if (fs.existsSync(rawPath)) {
      skippedExisting++;
      continue;
    }
    fs.writeFileSync(rawPath, JSON.stringify({ ...item, syncedAt: new Date().toISOString() }, null, 2));

    const { fact, tags } = itemFact(id, item);
    const summary = {
      id: item.id,
      title: item.title,
      body: item.body,
      when: item.when,
      who: item.who,
      source: id,
      syncedAt: new Date().toISOString(),
      facts: [fact],
    };
    fs.appendFileSync(summaries, JSON.stringify(summary) + '\n');

    if (opts.storeMemory !== false) {
      memory.storeFact(fact, 'fact', tags);
      factsStored++;
    }
    stored++;
  }

  const prev = loadState(id);
  const state = {
    lastRun: new Date().toISOString(),
    syncedCount: prev.syncedCount + stored,
    connectedAs: prev.connectedAs ?? undefined,
  };
  saveState(id, state);

  return {
    connectedAs: state.connectedAs ?? 'unknown',
    fetched: items.length,
    stored,
    skippedExisting,
    factsStored,
  };
}