// ── timps-code — Audit + Team Digest CLI Commands ──
// Phase 5e: International Team Features

import { Memory } from '../memory/memory.js';

export interface AuditOptions {
  member?: string;
  since?: string;
  type?: string;
  limit?: number;
  format?: 'table' | 'json';
}

export async function runAuditCommand(memory: Memory, options: AuditOptions): Promise<string> {
  const sinceTs = options.since ? parseDate(options.since) : Date.now() - 24 * 60 * 60 * 1000;
  const types = options.type ? [options.type] : undefined;

  const result = await memory.audit({
    actorId: options.member,
    since: sinceTs,
    types,
    limit: options.limit ?? 20,
  });

  if (options.format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  return formatAuditTable(result, options.member);
}

export async function runTeamDigestCommand(memory: Memory, since?: string): Promise<string> {
  const sinceTs = since ? parseDate(since) : Date.now() - 24 * 60 * 60 * 1000;
  const digest = await memory.getTeamDigest({ since: sinceTs });
  return digest.summary;
}

function parseDate(input: string): number {
  if (/^\d+$/.test(input)) return parseInt(input, 10);
  const d = new Date(input);
  if (!isNaN(d.getTime())) return d.getTime();
  return Date.now() - 24 * 60 * 60 * 1000;
}

function formatAuditTable(result: any, memberFilter?: string): string {
  const { entries, summary } = result;
  if (!entries || entries.length === 0) {
    return memberFilter
      ? `No audit entries found for "${memberFilter}" in the requested period.`
      : 'No audit entries found in the requested period.';
  }

  const lines: string[] = [];
  lines.push(`Audit Report — ${summary.totalEntries} entries`);
  lines.push('');

  for (const entry of entries) {
    const ts = new Date(entry.timestamp).toISOString().replace('T', ' ').slice(0, 19);
    const type = (entry.type ?? 'fact').padEnd(12);
    const platformTag = entry.platform ? `[${entry.platform}]` : '     ';
    const content = entry.content.slice(0, 80);
    lines.push(`  ${ts}  ${type}  ${platformTag}  ${content}`);
  }

  if (summary.types && Object.keys(summary.types).length > 0) {
    lines.push('');
    lines.push('By Type:');
    for (const [type, count] of Object.entries(summary.types)) {
      lines.push(`  ${type}: ${count}`);
    }
  }

  return lines.join('\n');
}
