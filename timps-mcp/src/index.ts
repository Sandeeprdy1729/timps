#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config();

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { z } from 'zod';
import { MemoryEngine } from '@timps/memory-core';

// ── Runtime mode ────────────────────────────────────────────────────────────
// LOCAL mode: TIMPS_URL is not set (or TIMPS_LOCAL=true).  All tools use
//   @timps/memory-core for deterministic, file-based intelligence — no server.
// SERVER mode: TIMPS_URL is set.  Tools proxy to the sandeep-ai HTTP API for
//   full LLM-powered intelligence (manifesto, dead reckoning, etc.).

const SERVER_MODE = !!(process.env.TIMPS_URL && process.env.TIMPS_URL !== '' && process.env.TIMPS_LOCAL !== 'true');
const TIMPS_URL = process.env.TIMPS_URL || 'http://localhost:3000';
const TIMPS_USER_ID = parseInt(process.env.TIMPS_USER_ID || '1', 10);
const PROJECT_PATH = process.env.TIMPS_PROJECT_PATH || process.cwd();

// Local memory engine (used in LOCAL mode)
const localEngine = new MemoryEngine(PROJECT_PATH);

async function timpsAPI(path: string, method = 'GET', body?: unknown): Promise<any> {
  const res = await fetch(`${TIMPS_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`TIMPs API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function chat(message: string, username?: string): Promise<string> {
  const data = await timpsAPI('/chat', 'POST', { userId: TIMPS_USER_ID, username, message });
  return data.response || 'No response from TIMPs';
}

async function main() {
  const server = new McpServer({ name: 'timps-mcp', version: '1.0.0' });
  const registerTool = server.registerTool.bind(server) as (
    name: string,
    config: { description: string; inputSchema: Record<string, unknown> },
    handler: (args: any) => any
  ) => void;

  // ── Core Memory ─────────────────────────────────────────────────────────────

  registerTool('timps_chat', {
    description: 'Send a message to TIMPs with full memory context. Automatically activates contradiction detection, burnout analysis, bug patterns, and other intelligence tools.',
    inputSchema: {
      message: z.string().describe('Message to send to TIMPs'),
      username: z.string().optional().describe('Optional username'),
    },
  }, async ({ message, username }) => ({
    content: [{ type: 'text' as const, text: await chat(message, username) }],
  }));

  registerTool('timps_get_memories', {
    description: 'Get all stored memories, goals, and preferences. Use before starting a complex task.',
    inputSchema: {},
  }, async () => {
    if (!SERVER_MODE) {
      const facts = localEngine.recall('', { limit: 10 });
      const working = localEngine.workingMemory;
      if (!facts.length && !working.currentGoal) {
        return { content: [{ type: 'text' as const, text: 'No memories stored yet.' }] };
      }
      const lines: string[] = [];
      if (working.currentGoal) lines.push(`**Current Goal:** ${working.currentGoal}`);
      if (facts.length) {
        lines.push(`\n**Memories (${facts.length}):**`);
        facts.forEach(f => lines.push(`- [${f.type}] ${f.content}`));
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
    const data = await timpsAPI(`/memory/${TIMPS_USER_ID}`);
    const memories: any[] = data.memories || [];
    const goals: any[] = data.goals || [];
    if (!memories.length && !goals.length) {
      return { content: [{ type: 'text' as const, text: 'No memories stored yet.' }] };
    }
    const text = [
      `**Memories (${memories.length}):**`,
      ...memories.slice(0, 10).map((m: any) => `- [${m.memory_type}] ${m.content} (importance: ${m.importance})`),
      `\n**Goals (${goals.length}):**`,
      ...goals.slice(0, 5).map((g: any) => `- ${g.title}`),
    ].join('\n');
    return { content: [{ type: 'text' as const, text }] };
  });

  registerTool('timps_store_memory', {
    description: 'Store an important fact in TIMPs long-term memory.',
    inputSchema: {
      content: z.string().describe('Memory to store'),
      importance: z.number().min(1).max(5).optional().describe('Importance 1-5'),
    },
  }, async ({ content, importance }) => {
    if (!SERVER_MODE) {
      localEngine.store({ content, type: 'fact', tags: importance ? [`importance:${importance}`] : [] });
      return { content: [{ type: 'text' as const, text: `✓ Stored: ${content}` }] };
    }
    await chat(`Remember this (importance ${importance || 3}/5): ${content}`);
    return { content: [{ type: 'text' as const, text: `✓ Stored: ${content}` }] };
  });

  // ── Contradiction Detection ──────────────────────────────────────────────────

  registerTool('timps_check_contradiction', {
    description: 'Check if a statement contradicts past positions. Use before any opinion or decision.',
    inputSchema: {
      text: z.string().describe('Statement to check'),
    },
  }, async ({ text }) => {
    if (!SERVER_MODE) {
      const result = localEngine.contradiction.check(text, true);
      if (result.verdict === 'CONTRADICTION' || result.verdict === 'PARTIAL') {
        const score = Math.round((result.contradiction_score || 0) * 100);
        const claim = result.matched_position?.extracted_claim || 'a past position';
        return { content: [{ type: 'text' as const, text:
          `⚠️ CONTRADICTION (${score}%)\n\nNow: "${text}"\nPast: "${claim}"\n\nHave you changed your mind?` }] };
      }
      return { content: [{ type: 'text' as const, text: `✓ No contradiction. Position stored.` }] };
    }
    const data = await timpsAPI('/contradiction/check', 'POST', {
      userId: TIMPS_USER_ID, text, autoStore: true,
    });
    if (data.verdict === 'CONTRADICTION' || data.verdict === 'PARTIAL') {
      const score = Math.round((data.contradiction_score || 0) * 100);
      const claim = data.conflicting_position?.extracted_claim || 'a past position';
      const date = data.conflicting_position?.created_at
        ? new Date(data.conflicting_position.created_at).toLocaleDateString() : 'earlier';
      return { content: [{ type: 'text' as const, text:
        `⚠️ CONTRADICTION (${score}%)\n\nNow: "${text}"\nPast (${date}): "${claim}"\n\nHave you changed your mind?` }] };
    }
    return { content: [{ type: 'text' as const, text: `✓ No contradiction. Position stored.` }] };
  });

  registerTool('timps_get_positions', {
    description: 'List all tracked positions with conflict counts.',
    inputSchema: {},
  }, async () => {
    if (!SERVER_MODE) {
      const positions = localEngine.contradiction.list();
      if (!positions.length) return { content: [{ type: 'text' as const, text: 'No positions stored yet.' }] };
      const text = [`**Positions (${positions.length}):**`,
        ...positions.slice(0, 15).map(p =>
          `- [${p.topic_cluster}] ${p.extracted_claim}${p.contradiction_count > 0 ? ` ⚠️ ${p.contradiction_count} conflict(s)` : ''}`)
      ].join('\n');
      return { content: [{ type: 'text' as const, text }] };
    }
    const data = await timpsAPI(`/positions/${TIMPS_USER_ID}`);
    const positions: any[] = data.positions || [];
    if (!positions.length) return { content: [{ type: 'text' as const, text: 'No positions stored yet.' }] };
    const text = [`**Positions (${data.total || positions.length}):**`,
      ...positions.slice(0, 15).map((p: any) =>
        `- [${p.topic_cluster}] ${p.extracted_claim}${p.contradiction_count > 0 ? ` ⚠️ ${p.contradiction_count} conflict(s)` : ''}`)
    ].join('\n');
    return { content: [{ type: 'text' as const, text }] };
  });

  // ── Regret Oracle ────────────────────────────────────────────────────────────

  registerTool('timps_check_regret', {
    description: 'Warn before repeating a past regretted decision.',
    inputSchema: { decision: z.string().describe('Decision being considered') },
  }, async ({ decision }) => {
    if (!SERVER_MODE) {
      const result = localEngine.regretOracle.check(decision);
      if (result.warning && result.matching_past_decision) {
        const d = result.matching_past_decision;
        return { content: [{ type: 'text' as const, text:
          `⚠️ REGRET WARNING (${Math.round(result.similarity_score * 100)}% match)\n\nPast decision: "${d}"\n\n${result.message}` }] };
      }
      return { content: [{ type: 'text' as const, text: result.message }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`Regret Oracle: am I about to repeat a regretted decision? "${decision}"`) }] };
  });

  registerTool('timps_log_decision', {
    description: 'Log a decision outcome to build the Regret Oracle knowledge base.',
    inputSchema: {
      description: z.string().describe('The decision made'),
      outcome: z.string().optional().describe('What happened'),
      regret_score: z.number().min(0).max(1).optional().describe('Regret 0-1'),
    },
  }, async ({ description, outcome, regret_score }) => {
    if (!SERVER_MODE) {
      const d = localEngine.regretOracle.log(description, outcome, regret_score ?? 0);
      return { content: [{ type: 'text' as const, text: `✓ Decision logged (regret: ${d.regret_score})` }] };
    }
    await chat(`Log decision: "${description}". Outcome: ${outcome || 'unknown'}. Regret: ${regret_score ?? 0}`);
    return { content: [{ type: 'text' as const, text: `✓ Decision logged` }] };
  });

  // ── Burnout Seismograph ──────────────────────────────────────────────────────

  registerTool('timps_burnout_analyze', {
    description: 'Analyze burnout risk vs personal baseline. Use when user mentions stress or exhaustion.',
    inputSchema: {},
  }, async () => {
    if (!SERVER_MODE) {
      const r = localEngine.burnoutSeismograph.analyze();
      return { content: [{ type: 'text' as const, text:
        `**Burnout Risk: ${r.risk_level.toUpperCase()}** (score: ${r.risk_score}/100)\n\n${r.recommendation}${r.weeks_to_burnout_estimate ? `\n\nEstimated weeks to burnout: ${r.weeks_to_burnout_estimate}` : ''}` }] };
    }
    return { content: [{ type: 'text' as const, text: await chat('Burnout Seismograph: analyze my current risk vs personal baseline.') }] };
  });

  registerTool('timps_record_signal', {
    description: 'Log a behavioral signal for burnout tracking.',
    inputSchema: {
      signal_type: z.string().describe('focus_hours | energy_level | enthusiasm_score | commits_per_day'),
      value: z.number().describe('Signal value'),
    },
  }, async ({ signal_type, value }) => {
    if (!SERVER_MODE) {
      localEngine.burnoutSeismograph.record(signal_type, value);
      return { content: [{ type: 'text' as const, text: `✓ Signal: ${signal_type} = ${value}` }] };
    }
    await chat(`Record burnout signal: ${signal_type} = ${value}`);
    return { content: [{ type: 'text' as const, text: `✓ Signal: ${signal_type} = ${value}` }] };
  });

  // ── Bug Pattern Prophet ──────────────────────────────────────────────────────

  registerTool('timps_warn_bug_pattern', {
    description: 'Check if coding context matches personal bug triggers. Use before writing code under pressure.',
    inputSchema: { context: z.string().describe('Current coding context and conditions') },
  }, async ({ context }) => {
    if (!SERVER_MODE) {
      const r = localEngine.bugPattern.warn(context);
      if (r.alert) {
        return { content: [{ type: 'text' as const, text:
          `⚠️ BUG RISK: ${r.risk_level.toUpperCase()}\n\nLikely bugs: ${r.likely_bug_types.join(', ')}\n${r.suggestion}` }] };
      }
      return { content: [{ type: 'text' as const, text: `✓ ${r.reason}` }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`Bug Pattern Prophet: check my triggers for: ${context}`) }] };
  });

  registerTool('timps_record_bug', {
    description: 'Record a bug to build personal pattern profile.',
    inputSchema: {
      bug_type: z.string().describe('race_condition | null_pointer | off_by_one | memory_leak | etc.'),
      trigger_context: z.string().optional().describe('Context when bug appeared'),
    },
  }, async ({ bug_type, trigger_context }) => {
    if (!SERVER_MODE) {
      const p = localEngine.bugPattern.recordBug(bug_type, trigger_context);
      return { content: [{ type: 'text' as const, text: `✓ Bug recorded: ${bug_type} (seen ${p.frequency}x)` }] };
    }
    await chat(`Record bug: ${bug_type}. Context: ${trigger_context || 'unknown'}`);
    return { content: [{ type: 'text' as const, text: `✓ Bug recorded: ${bug_type}` }] };
  });

  // ── Tech Debt Seismograph ────────────────────────────────────────────────────

  registerTool('timps_check_tech_debt', {
    description: 'Check if code pattern matches past codebase incidents. Use during code review.',
    inputSchema: {
      pattern: z.string().describe('Code pattern or approach'),
      project_id: z.string().optional().describe('Project ID'),
    },
  }, async ({ pattern, project_id }) => {
    if (!SERVER_MODE) {
      const r = localEngine.techDebt.checkPattern(pattern, project_id);
      if (r.warning) {
        return { content: [{ type: 'text' as const, text:
          `⚠️ TECH DEBT RISK: ${r.risk_level.toUpperCase()}\n\n${r.message}` }] };
      }
      return { content: [{ type: 'text' as const, text: `✓ ${r.message}` }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`Tech Debt Seismograph for ${project_id || 'default'}: "${pattern}"`) }] };
  });

  registerTool('timps_record_incident', {
    description: 'Record a production incident to build pattern library.',
    inputSchema: {
      pattern: z.string().describe('Code pattern that caused the incident'),
      incident_type: z.string().optional().describe('Incident type'),
      time_to_debug_hrs: z.number().optional().describe('Debug hours'),
    },
  }, async ({ pattern, incident_type, time_to_debug_hrs }) => {
    if (!SERVER_MODE) {
      localEngine.techDebt.recordIncident(pattern, 'default', incident_type || 'unknown', time_to_debug_hrs);
      return { content: [{ type: 'text' as const, text: `✓ Incident recorded` }] };
    }
    await chat(`Record incident: "${pattern}", type: ${incident_type || 'unknown'}, hours: ${time_to_debug_hrs || '?'}`);
    return { content: [{ type: 'text' as const, text: `✓ Incident recorded` }] };
  });

  // ── API Archaeologist ────────────────────────────────────────────────────────

  registerTool('timps_lookup_api', {
    description: 'Look up known quirks for an API before using it.',
    inputSchema: { api_name: z.string().describe('API name: Stripe, GitHub, etc.') },
  }, async ({ api_name }) => {
    if (!SERVER_MODE) {
      const r = localEngine.apiArchaeologist.lookup(api_name);
      if (!r.total) return { content: [{ type: 'text' as const, text: `No quirks recorded yet for ${api_name}. Use timps_record_api_quirk to add one.` }] };
      const lines = r.quirks.map(q => `• [${q.severity}]${q.endpoint ? ` ${q.endpoint}` : ''}: ${q.discovered_quirk}`);
      return { content: [{ type: 'text' as const, text: `**${api_name} quirks (${r.total}):**\n${lines.join('\n')}` }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`API Archaeologist: quirks for ${api_name}?`) }] };
  });

  registerTool('timps_record_api_quirk', {
    description: 'Save a discovered API quirk for future reference.',
    inputSchema: {
      api_name: z.string().describe('API name'),
      endpoint: z.string().optional().describe('Specific endpoint'),
      quirk: z.string().describe('The undocumented behavior'),
      severity: z.enum(['info', 'warning', 'critical']).optional(),
    },
  }, async ({ api_name, endpoint, quirk, severity }) => {
    if (!SERVER_MODE) {
      localEngine.apiArchaeologist.recordQuirk(api_name, quirk, endpoint, severity);
      return { content: [{ type: 'text' as const, text: `✓ Saved: ${api_name} — ${quirk}` }] };
    }
    await chat(`Save API quirk for ${api_name}${endpoint ? ` (${endpoint})` : ''}: ${quirk}. Severity: ${severity || 'info'}`);
    return { content: [{ type: 'text' as const, text: `✓ Saved: ${api_name} — ${quirk}` }] };
  });

  // ── Meeting Ghost ────────────────────────────────────────────────────────────

  registerTool('timps_extract_commitments', {
    description: 'Extract commitments from meeting notes. Use after any meeting.',
    inputSchema: {
      meeting_notes: z.string().describe('Raw meeting notes or transcript'),
      meeting_title: z.string().optional().describe('Meeting name'),
    },
  }, async ({ meeting_notes, meeting_title }) => ({
    content: [{ type: 'text' as const, text: await chat(
      `Meeting Ghost: extract commitments from "${meeting_title || 'meeting'}":\n${meeting_notes}`
    ) }],
  }));

  registerTool('timps_get_pending_commitments', {
    description: 'List all pending commitments not yet completed.',
    inputSchema: {},
  }, async () => ({
    content: [{ type: 'text' as const, text: await chat('Meeting Ghost: list all pending commitments.') }],
  }));

  // ── Relationship Intelligence ────────────────────────────────────────────────

  registerTool('timps_relationship_check', {
    description: 'Check relationship health and drift alerts. Use when user mentions a person.',
    inputSchema: {
      contact_name: z.string().optional().describe('Person name — omit for all drift alerts'),
    },
  }, async ({ contact_name }) => ({
    content: [{ type: 'text' as const, text: await chat(
      contact_name
        ? `Relationship Intelligence: health for ${contact_name}`
        : 'Relationship Intelligence: show all drift alerts'
    ) }],
  }));

  // ── Dead Reckoning ───────────────────────────────────────────────────────────

  registerTool('timps_simulate_decision', {
    description: 'Simulate future outcomes for a decision based on actual history.',
    inputSchema: {
      scenario: z.string().describe('Decision or situation to simulate'),
      horizon_months: z.number().optional().describe('Months ahead (default 12)'),
    },
  }, async ({ scenario, horizon_months }) => ({
    content: [{ type: 'text' as const, text: await chat(
      `Dead Reckoning: simulate ${horizon_months || 12} months for: ${scenario}`
    ) }],
  }));

  // ── Living Manifesto ─────────────────────────────────────────────────────────

  registerTool('timps_get_manifesto', {
    description: 'Get the Living Manifesto — actual values from behavioral patterns, not stated beliefs.',
    inputSchema: {},
  }, async () => ({
    content: [{ type: 'text' as const, text: await chat('Show my Living Manifesto.') }],
  }));

  // ── Chronos Veil (Temporal Apex Veil) ─────────────────────────────────────

  registerTool('timps_chronos_ingest', {
    description: 'Ingest a signal into Chronos Veil with layered persistence. Auto-classifies into knowledge/memory/wisdom/intelligence with entity linking.',
    inputSchema: {
      content: z.string().describe('The signal or event to ingest'),
      source_module: z.string().describe('Source: timps-code, timps-vscode, timps-mcp, reflection, etc.'),
      tags: z.array(z.string()).optional().describe('Entity tags: code, bug, tech-debt, api, burnout, relationship'),
      entity: z.string().optional().describe('Primary entity identifier'),
    },
  }, async ({ content, source_module, tags, entity }) => {
    const data = await timpsAPI('/chronos/ingest', 'POST', {
      content,
      sourceModule: source_module,
      tags: tags || [],
      entity,
      userId: TIMPS_USER_ID,
      projectId: process.env.TIMPS_PROJECT_ID || 'default',
    });
    return { content: [{ type: 'text' as const, text: `✓ Event ${data.eventId} → layer: ${data.layer}, entities: ${(data.entities || []).join(', ')}` }] };
  });

  registerTool('timps_chronos_query', {
    description: 'Query Chronos Veil with the multi-tool resolution agent. Resolves conflicts and produces compact temporal summaries.',
    inputSchema: {
      query: z.string().describe('Temporal query (e.g. "how has my bug patterns evolved?", "what API decisions were superseded?")'),
      limit: z.number().optional().describe('Max events to return (default 8)'),
    },
  }, async ({ query, limit }) => {
    const data = await timpsAPI('/chronos/query', 'POST', {
      query,
      userId: TIMPS_USER_ID,
      projectId: process.env.TIMPS_PROJECT_ID || 'default',
      limit: limit || 8,
    });
    if (!data.resolvedEvents || data.resolvedEvents.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No temporal events found for this query.' }] };
    }
    const conf = (data.confidence || 0).toFixed(2);
    const lines = [`**Chronos Veil Resolution (confidence: ${conf})**\n`];
    for (const ev of data.resolvedEvents) {
      const sup = ev.supersedes ? ' ←supersedes' : '';
      lines.push(`- [${ev.layer}] ${(ev.content || '').slice(0, 80)}${sup} (conf: ${ev.confidence.toFixed(2)})`);
    }
    if (data.conflicts && data.conflicts.length > 0) {
      lines.push(`\n⚠️ Unresolved conflicts: ${data.conflicts.join('; ')}`);
    }
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  });

  registerTool('timps_chronos_stats', {
    description: 'Get Chronos Veil statistics: event counts by layer, recent events, and entity graph edges.',
    inputSchema: {},
  }, async () => {
    const data = await timpsAPI(`/chronos/stats/${TIMPS_USER_ID}`);
    const byLayer = data.byLayer || {};
    const text = [
      `**Chronos Veil Stats**`,
      `Total events: ${data.total || 0}`,
      `  Knowledge: ${byLayer.knowledge || 0} (facts, decisions, resolved positions)`,
      `  Memory: ${byLayer.memory || 0} (experiences with decay)`,
      `  Wisdom: ${byLayer.wisdom || 0} (evidence-gated insights)`,
      `  Intelligence: ${byLayer.intelligence || 0} (ephemeral drafts)`,
    ].join('\n');
    return { content: [{ type: 'text' as const, text }] };
  });

  // ── NexusForge (Episodic Sub-Agent Trinity) ─────────────────────────────

  registerTool('timps_nexus_ingest', {
    description: 'Ingest a signal into NexusForge episodic memory. Builds hybrid graph nodes with time-aware gists and factual links. Use after coding sessions, decisions, or notable events.',
    inputSchema: {
      content: z.string().describe('The signal or event to ingest'),
      source_module: z.string().describe('Source: timps-code, timps-vscode, timps-mcp, cli, etc.'),
      tags: z.array(z.string()).optional().describe('Entity tags: code, bug, tech-debt, api, burnout, relationship, regret'),
    },
  }, async ({ content, source_module, tags }) => {
    const data = await timpsAPI('/nexus/ingest', 'POST', {
      content,
      sourceModule: source_module,
      tags: tags || [],
      userId: TIMPS_USER_ID,
      projectId: process.env.TIMPS_PROJECT_ID || 'default',
    });
    return { content: [{ type: 'text' as const, text: data.success ? `✓ Episodic node created: ${data.nodeId}` : 'NexusForge ingest failed or disabled' }] };
  });

  registerTool('timps_nexus_query', {
    description: 'Query NexusForge episodic memory with agentic iterative retrieval. Returns episodic nodes with spatiotemporal context, refusal when evidence is insufficient.',
    inputSchema: {
      query: z.string().describe('Episodic query (e.g. "what coding sessions led to burnout signals?", "show my regret patterns around API decisions")'),
    },
  }, async ({ query }) => {
    const data = await timpsAPI('/nexus/query', 'POST', {
      query,
      userId: TIMPS_USER_ID,
      projectId: process.env.TIMPS_PROJECT_ID || 'default',
    });
    if (data.refusal) {
      return { content: [{ type: 'text' as const, text: `No episodic matches found (confidence: ${(data.confidence || 0).toFixed(2)})` }] };
    }
    if (!data.results || data.results.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No episodic results.' }] };
    }
    const conf = (data.confidence || 0).toFixed(2);
    const lines = [`**NexusForge Results (confidence: ${conf})**\n`];
    for (const r of data.results.slice(0, 8)) {
      lines.push(`- [${r.source_module || 'unknown'}] ${(r.gist || r.content || '').slice(0, 120)} (${new Date(r.created_at).toLocaleDateString()})`);
    }
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  });

  registerTool('timps_nexus_stats', {
    description: 'Get NexusForge episodic memory statistics: node counts, edge counts, and source breakdown.',
    inputSchema: {},
  }, async () => {
    const data = await timpsAPI(`/nexus/stats/${TIMPS_USER_ID}`);
    const sources = data.sources || {};
    const srcLines = Object.entries(sources).map(([k, v]) => `  ${k}: ${v}`).join('\n');
    const text = [
      `**NexusForge Stats**`,
      `Episodic nodes: ${data.totalNodes || 0}`,
      `Temporal edges: ${data.totalEdges || 0}`,
      `Causal edges: ${data.totalCausal || 0}`,
      `Sources:\n${srcLines || '  none'}`,
    ].join('\n');
    return { content: [{ type: 'text' as const, text }] };
  });

  registerTool('timps_nexus_graph', {
    description: 'Get the episodic graph structure (nodes + edges) for visualization. Returns recent episodic nodes and their temporal/causal links.',
    inputSchema: {
      limit: z.number().optional().describe('Max nodes to return (default 30)'),
    },
  }, async ({ limit }) => {
    const data = await timpsAPI(`/nexus/graph/${TIMPS_USER_ID}?limit=${limit || 30}`);
    const nodes = data.nodes || [];
    const edges = data.edges || [];
    if (nodes.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No episodic graph data.' }] };
    }
    const text = [
      `**Episodic Graph** (${nodes.length} nodes, ${edges.length} edges)`,
      nodes.slice(0, 10).map((n: any) =>
        `- ${n.isCoding ? '[code] ' : ''}${(n.gist || '').slice(0, 80)} (${n.source_module})`
      ).join('\n'),
    ].join('\n');
    return { content: [{ type: 'text' as const, text }] };
  });

  // ── SynapseMetabolon (Spreading Activation Metabolic Graph) ─────────────

  registerTool('timps_synapse_ingest', {
    description: 'Ingest a signal into SynapseMetabolon spreading activation graph. Classifies into interaction/reasoning/audit layers with automatic entity linking and activation spread.',
    inputSchema: {
      content: z.string().describe('The signal or event to ingest'),
      source_module: z.string().describe('Source: timps-code, timps-vscode, timps-mcp, reflection, etc.'),
      tags: z.array(z.string()).optional().describe('Entity tags: code, bug, tech-debt, api, burnout, relationship'),
      entity: z.string().optional().describe('Primary entity identifier'),
    },
  }, async ({ content, source_module, tags, entity }) => {
    const data = await timpsAPI('/synapse/ingest', 'POST', {
      content,
      sourceModule: source_module,
      tags: tags || [],
      entity,
      userId: TIMPS_USER_ID,
      projectId: process.env.TIMPS_PROJECT_ID || 'default',
    });
    return { content: [{ type: 'text' as const, text: `✓ Node ${data.nodeId} → layer: ${data.layer}, activation: ${(data.activation || 0).toFixed(2)}, entities: ${(data.entities || []).join(', ')}` }] };
  });

  registerTool('timps_synapse_query', {
    description: 'Query SynapseMetabolon with spreading activation. Spreads from seed nodes through relational edges, runs metabolic cycle, and returns activated nodes with confidence scores.',
    inputSchema: {
      query: z.string().describe('Metabolic graph query (e.g. "how do my coding sessions relate to burnout?", "show patterns around API decisions")'),
      limit: z.number().optional().describe('Max activated nodes to return (default 10)'),
    },
  }, async ({ query, limit }) => {
    const data = await timpsAPI('/synapse/query', 'POST', {
      query,
      userId: TIMPS_USER_ID,
      projectId: process.env.TIMPS_PROJECT_ID || 'default',
      limit: limit || 10,
    });
    if (!data.activatedNodes || data.activatedNodes.length === 0) {
      return { content: [{ type: 'text' as const, text: `No metabolic matches found (confidence: ${(data.confidence || 0).toFixed(2)})` }] };
    }
    const conf = (data.confidence || 0).toFixed(2);
    const lines = [`**SynapseMetabolon Results (confidence: ${conf})**\n`];
    for (const n of data.activatedNodes.slice(0, 8)) {
      lines.push(`- [${n.layer}] (act:${(n.activation || 0).toFixed(2)}) ${(n.content || '').slice(0, 100)} [${n.sourceModule}]`);
    }
    if (data.summary) {
      lines.push(`\n${data.summary}`);
    }
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  });

  registerTool('timps_synapse_stats', {
    description: 'Get SynapseMetabolon statistics: node counts, edge counts, layer breakdown, and average activation.',
    inputSchema: {},
  }, async () => {
    const data = await timpsAPI(`/synapse/stats/${TIMPS_USER_ID}`);
    const layers = data.layers || {};
    const layerLines = Object.entries(layers).map(([k, v]: [string, any]) =>
      `  ${k}: ${v.count || 0} nodes (avg activation: ${(v.avgActivation || 0).toFixed(2)})`
    ).join('\n');
    const text = [
      `**SynapseMetabolon Stats**`,
      `Total nodes: ${data.totalNodes || 0}`,
      `Total edges: ${data.totalEdges || 0}`,
      `Avg activation: ${(data.avgActivation || 0).toFixed(2)}`,
      `Layers:\n${layerLines || '  none'}`,
    ].join('\n');
    return { content: [{ type: 'text' as const, text }] };
  });

  registerTool('timps_synapse_graph', {
    description: 'Get the metabolic graph structure (nodes + edges) for visualization. Returns nodes with activation scores and layer information.',
    inputSchema: {
      limit: z.number().optional().describe('Max nodes to return (default 30)'),
    },
  }, async ({ limit }) => {
    const data = await timpsAPI(`/synapse/graph/${TIMPS_USER_ID}?limit=${limit || 30}`);
    const nodes = data.nodes || [];
    const edges = data.edges || [];
    if (nodes.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No metabolic graph data.' }] };
    }
    const text = [
      `**Metabolic Graph** (${nodes.length} nodes, ${edges.length} edges)`,
      nodes.slice(0, 10).map((n: any) =>
        `- [${n.layer}] (act:${(n.activation || 0).toFixed(2)}) ${(n.content || '').slice(0, 60)} (${n.source_module})`
      ).join('\n'),
    ].join('\n');
    return { content: [{ type: 'text' as const, text }] };
  });

  registerTool('timps_synapse_consolidate', {
    description: 'Run a metabolic consolidation cycle. Consolidates high-activation nodes, audits low-utility nodes, refreshes stale nodes, and decays inactive ones.',
    inputSchema: {},
  }, async () => {
    const data = await timpsAPI(`/synapse/consolidate/${TIMPS_USER_ID}`, 'POST', {
      projectId: process.env.TIMPS_PROJECT_ID || 'default',
    });
    const text = [
      `**Consolidation Cycle Complete**`,
      `Consolidated: ${data.consolidated || 0}`,
      `Audited: ${data.audited || 0}`,
      `Refreshed: ${data.refreshed || 0}`,
      `Decayed: ${data.decayed || 0}`,
    ].join('\n');
    return { content: [{ type: 'text' as const, text }] };
  });

  // ── Phase 2: Session & Context Tools ────────────────────────────────────────

  registerTool('timps_get_session_history', {
    description: 'Retrieve what you were working on in recent sessions. Use before starting a task to restore context.',
    inputSchema: {
      days_back: z.number().int().min(1).max(30).optional().describe('How many days back (default: 7)'),
    },
  }, async ({ days_back }) => {
    if (!SERVER_MODE) {
      const limit = (days_back || 7) * 5;
      const episodes = localEngine.loadEpisodes(limit);
      if (!episodes.length) return { content: [{ type: 'text' as const, text: 'No session history yet.' }] };
      const cutoff = Date.now() - (days_back || 7) * 86400_000;
      const recent = episodes.filter(e => new Date(e.timestamp).getTime() >= cutoff);
      if (!recent.length) return { content: [{ type: 'text' as const, text: `No sessions in the last ${days_back || 7} days.` }] };
      const lines = recent.slice(0, 20).map(e => {
        const d = new Date(e.timestamp).toLocaleDateString();
        return `- [${d}] [${e.outcome}] ${e.summary.slice(0, 100)}`;
      });
      return { content: [{ type: 'text' as const, text: `**Session history (last ${days_back || 7} days):**\n${lines.join('\n')}` }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`What was I working on in the last ${days_back || 7} days? Summarize my session history.`) }] };
  });

  registerTool('timps_get_architecture_decisions', {
    description: 'Retrieve past architecture decisions and design choices. Use when making structural code decisions.',
    inputSchema: {
      topic: z.string().optional().describe('Filter by topic (e.g. auth, database, state)'),
    },
  }, async ({ topic }) => {
    if (!SERVER_MODE) {
      const query = topic ? `architecture decision ${topic}` : 'architecture decision design pattern';
      const results = localEngine.recall(query, { limit: 10 });
      if (!results.length) return { content: [{ type: 'text' as const, text: 'No architecture decisions recorded yet. Use timps_store_memory to save decisions.' }] };
      const lines = results.map(r => `- ${r.content}`);
      return { content: [{ type: 'text' as const, text: `**Architecture decisions${topic ? ` (${topic})` : ''}:**\n${lines.join('\n')}` }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`What architecture decisions have we made${topic ? ` about ${topic}` : ''}?`) }] };
  });

  registerTool('timps_get_code_patterns', {
    description: 'Retrieve personal coding patterns and conventions I always use.',
    inputSchema: {
      context: z.string().optional().describe('Filter by context or language'),
    },
  }, async ({ context }) => {
    if (!SERVER_MODE) {
      const patterns = localEngine.patternLearner.getAll(context);
      if (!patterns.length) return { content: [{ type: 'text' as const, text: 'No code patterns recorded yet. Use timps_record_pattern to save patterns.' }] };
      const lines = patterns.map(p => `- [${p.tags.join(', ')}] ${p.content}`);
      return { content: [{ type: 'text' as const, text: `**Code patterns${context ? ` (${context})` : ''}:**\n${lines.join('\n')}` }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`What coding patterns and conventions do I always use${context ? ` for ${context}` : ''}?`) }] };
  });

  registerTool('timps_record_pattern', {
    description: 'Store a reusable code pattern or convention for future recall.',
    inputSchema: {
      pattern: z.string().describe('The code pattern or convention to store'),
      tags: z.array(z.string()).optional().describe('Tags like ["typescript", "react", "error-handling"]'),
    },
  }, async ({ pattern, tags }) => {
    if (!SERVER_MODE) {
      const result = localEngine.patternLearner.learn(pattern, tags || []);
      if (!result) return { content: [{ type: 'text' as const, text: '⚠️ Similar pattern already exists (>80% match). Skipped.' }] };
      return { content: [{ type: 'text' as const, text: `✓ Pattern stored` + (tags?.length ? ` [${tags.join(', ')}]` : '') }] };
    }
    await chat(`Store this code pattern: ${pattern}. Tags: ${(tags || []).join(', ')}`);
    return { content: [{ type: 'text' as const, text: `✓ Pattern stored` }] };
  });

  registerTool('timps_get_patterns_for_context', {
    description: 'Retrieve code patterns relevant to the current file or task context.',
    inputSchema: {
      file_path: z.string().optional().describe('Current file path'),
      task_description: z.string().describe('What you are trying to do'),
    },
  }, async ({ file_path, task_description }) => {
    if (!SERVER_MODE) {
      const taskDescription = String(task_description);
      const query = [taskDescription, file_path].filter(Boolean).join(' ');
      const results = localEngine.recall(query, { limit: 5 });
      const patterns = localEngine.patternLearner.getAll();
      // score patterns by jaccard similarity to task
      const taskTokens = new Set<string>(taskDescription.toLowerCase().split(/\W+/));
      const scored = patterns.map(p => {
        const pTokens = new Set<string>(p.content.toLowerCase().split(/\W+/));
        const inter = [...taskTokens].filter(t => pTokens.has(t)).length;
        const union = new Set([...taskTokens, ...pTokens]).size;
        return { p, score: inter / (union || 1) };
      }).sort((a, b) => b.score - a.score).slice(0, 5).filter(x => x.score > 0);
      const lines: string[] = [];
      if (scored.length) {
        lines.push('**Relevant patterns:**');
        scored.forEach(({ p }) => lines.push(`- ${p.content}`));
      }
      if (results.length) {
        lines.push('\n**Related memories:**');
        results.forEach(r => lines.push(`- ${r.content.slice(0, 120)}`));
      }
      if (!lines.length) return { content: [{ type: 'text' as const, text: 'No relevant patterns found for this context.' }] };
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`What patterns are relevant for: ${task_description}${file_path ? ` in ${file_path}` : ''}?`) }] };
  });

  registerTool('timps_detect_architecture_drift', {
    description: 'Compare current code structure against past architectural decisions and detect drift.',
    inputSchema: {
      current_patterns: z.array(z.string()).describe('Patterns observed in current codebase'),
      project_id: z.string().optional().describe('Project ID'),
    },
  }, async ({ current_patterns, project_id }) => {
    if (!SERVER_MODE) {
      const r = localEngine.architectureDrift.driftCheck(current_patterns, project_id || 'default');
      if (r.hasDrift) {
        const drifts = r.driftedAreas.map((area: string) => `  • ${area}`).join('\n');
        return { content: [{ type: 'text' as const, text: `⚠️ ARCHITECTURE DRIFT DETECTED\n\n${drifts}\n\n${r.explanation}` }] };
      }
      return { content: [{ type: 'text' as const, text: `✓ No drift. Codebase matches ${r.alignedWith.length} known patterns.` }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`Detect architecture drift. Current patterns: ${current_patterns.join(', ')}`) }] };
  });

  // ── Phase 2: Risk Tools ──────────────────────────────────────────────────────

  registerTool('timps_predict_bug_risk', {
    description: 'Predict bug risk for a planned change based on past incident history.',
    inputSchema: {
      change_description: z.string().describe('What you are about to change or add'),
      files_affected: z.array(z.string()).optional().describe('Files being changed'),
    },
  }, async ({ change_description, files_affected }) => {
    if (!SERVER_MODE) {
      const context = [change_description, ...(files_affected || [])].join(' ');
      const bugWarn = localEngine.bugPattern.warn(context);
      const debtCheck = localEngine.techDebt.checkPattern(change_description, 'default');
      const lines: string[] = [];
      if (bugWarn.alert) {
        lines.push(`⚠️ BUG RISK: ${bugWarn.risk_level.toUpperCase()}`);
        lines.push(`Likely bugs: ${bugWarn.likely_bug_types.join(', ')}`);
        lines.push(bugWarn.suggestion);
      }
      if (debtCheck.warning) {
        lines.push(`\n⚠️ TECH DEBT RISK: ${debtCheck.risk_level.toUpperCase()}`);
        lines.push(debtCheck.message);
      }
      if (!lines.length) return { content: [{ type: 'text' as const, text: `✓ Low risk. No matching patterns in personal incident history.` }] };
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`Predict bug risk for: ${change_description}. Files: ${(files_affected || []).join(', ')}`) }] };
  });

  registerTool('timps_get_incident_timeline', {
    description: 'Show past incidents and bugs in a specific module or area.',
    inputSchema: {
      module: z.string().describe('Module name or area (e.g. auth, payment, queue)'),
    },
  }, async ({ module }) => {
    if (!SERVER_MODE) {
      const allIncidents = localEngine.techDebt.getIncidents();
      const relevant = allIncidents.filter((inc) =>
        inc.pattern.toLowerCase().includes(module.toLowerCase())
      );
      if (!relevant.length) return { content: [{ type: 'text' as const, text: `No incidents recorded for "${module}". Use timps_record_incident to track future incidents.` }] };
      const lines = relevant.map((inc) => {
        const d = new Date(inc.occurred_at).toLocaleDateString();
        return `- [${d}] ${inc.pattern} (type: ${inc.incident_type}${inc.time_to_debug_hrs ? `, ~${inc.time_to_debug_hrs}h to fix` : ''})`;
      });
      return { content: [{ type: 'text' as const, text: `**Incident timeline — ${module} (${relevant.length} incidents):**\n${lines.join('\n')}` }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`Show incident timeline for the ${module} module.`) }] };
  });

  registerTool('timps_check_deployment_risk', {
    description: 'Check if a deployment pattern has caused issues before.',
    inputSchema: {
      pattern: z.string().describe('Deployment approach or config being used'),
    },
  }, async ({ pattern }) => {
    if (!SERVER_MODE) {
      const r = localEngine.techDebt.checkPattern(pattern, 'default');
      if (r.warning) {
        return { content: [{ type: 'text' as const, text: `⚠️ DEPLOYMENT RISK: ${r.risk_level.toUpperCase()}\n\n${r.message}` }] };
      }
      return { content: [{ type: 'text' as const, text: `✓ No past incidents with this deployment pattern.` }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`Deployment risk check: "${pattern}" — has this caused issues before?`) }] };
  });

  // ── Phase 2: Developer Intelligence Tools ───────────────────────────────────

  registerTool('timps_get_velocity_trend', {
    description: 'Show productivity trend — am I faster or slower this week vs baseline?',
    inputSchema: {},
  }, async () => {
    if (!SERVER_MODE) {
      const r = localEngine.velocityTracker.coach('velocity trend this week');
      const { patterns } = localEngine.velocityTracker.getPatterns();
      const lines: string[] = [`**Velocity Coach:**`, r.advice];
      if (r.relevant_pattern) {
        lines.push(`\n**Most relevant pattern:** ${r.relevant_pattern}`);
      }
      if (r.action_now) lines.push(`\n**Action:** ${r.action_now}`);
      if (patterns.length) {
        const avg = patterns.reduce((s: number, p: any) => s + p.success_rate, 0) / patterns.length;
        lines.push(`\nBaseline success rate: ${Math.round(avg * 100)}%`);
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
    return { content: [{ type: 'text' as const, text: await chat('Velocity trend: am I faster or slower this week vs my baseline?') }] };
  });

  registerTool('timps_get_context_switches', {
    description: 'Count and analyze context switches in current session.',
    inputSchema: {},
  }, async () => {
    if (!SERVER_MODE) {
      const episodes = localEngine.loadEpisodes(50);
      const today = new Date().toDateString();
      const todayEps = episodes.filter(e => new Date(e.timestamp).toDateString() === today);
      const types = todayEps.reduce((acc: Record<string, number>, e) => {
        acc[e.outcome] = (acc[e.outcome] || 0) + 1;
        return acc;
      }, {});
      const switches = todayEps.length;
      const lines = [`**Context switches today: ${switches}**`];
      Object.entries(types).forEach(([t, c]) => lines.push(`- ${t}: ${c}`));
      if (switches > 10) lines.push('\n⚠️ High context switching detected. Consider time-blocking.');
      else if (switches === 0) lines.push('\nNo activity logged yet today.');
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
    return { content: [{ type: 'text' as const, text: await chat('How many context switches have I done today? Is it affecting my focus?') }] };
  });

  registerTool('timps_record_learning', {
    description: 'Store something you learned today for future reference.',
    inputSchema: {
      learning: z.string().describe('What you learned'),
      topic: z.string().optional().describe('Topic or technology'),
    },
  }, async ({ learning, topic }) => {
    if (!SERVER_MODE) {
      localEngine.store({ content: learning, type: 'fact', tags: ['learning', ...(topic ? [topic] : [])] });
      localEngine.velocityTracker.observe('learning', learning);
      return { content: [{ type: 'text' as const, text: `✓ Learning stored${topic ? ` [${topic}]` : ''}: ${learning.slice(0, 80)}` }] };
    }
    await chat(`Record learning: ${learning}. Topic: ${topic || 'general'}`);
    return { content: [{ type: 'text' as const, text: `✓ Learning stored` }] };
  });

  registerTool('timps_get_shared_decisions', {
    description: 'Retrieve team-level architecture decisions. Scoped to the current project.',
    inputSchema: {
      topic: z.string().optional().describe('Filter by topic'),
    },
  }, async ({ topic }) => {
    if (!SERVER_MODE) {
      const query = topic ? `team decision ${topic}` : 'team architecture decision';
      const results = localEngine.recall(query, { limit: 10 });
      const archInsights = localEngine.architectureDrift.cultureReport('default');
      const lines: string[] = [];
      if (results.length) {
        lines.push('**Decisions:**');
        results.forEach(r => lines.push(`- ${r.content}`));
      }
      if (archInsights.insight_count > 0) {
        lines.push('\n**Architecture culture:**');
        archInsights.insights.slice(0, 5).forEach(i =>
          lines.push(`- [${i.insight_type}] ${i.description.slice(0, 100)}`)
        );
      }
      if (!lines.length) return { content: [{ type: 'text' as const, text: 'No shared decisions yet. Use timps_store_memory with type "decision" to record team decisions.' }] };
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
    return { content: [{ type: 'text' as const, text: await chat(`What team architecture decisions exist${topic ? ` about ${topic}` : ''}?`) }] };
  });

  registerTool('timps_record_review_pattern', {
    description: 'Store something you consistently flag or look for during code reviews.',
    inputSchema: {
      pattern: z.string().describe('What you always check or flag in reviews'),
      severity: z.enum(['info', 'warning', 'blocker']).optional(),
    },
  }, async ({ pattern, severity }) => {
    if (!SERVER_MODE) {
      localEngine.store({ content: `[review-pattern][${severity || 'info'}] ${pattern}`, type: 'pattern', tags: ['code-review', severity || 'info'] });
      localEngine.patternLearner.learn(pattern, ['code-review', severity || 'info']);
      return { content: [{ type: 'text' as const, text: `✓ Review pattern stored [${severity || 'info'}]: ${pattern.slice(0, 80)}` }] };
    }
    await chat(`Store review pattern [${severity || 'info'}]: ${pattern}`);
    return { content: [{ type: 'text' as const, text: `✓ Review pattern stored` }] };
  });

  // ── ChronosForge: Temporal Causal Memory ─────────────────────────────────────

  registerTool('timps_temporal_query', {
    description:
      'Query memories that were valid at a specific point in time. ' +
      'Use for historical reconstruction ("what did I believe on March 15?"), ' +
      'longitudinal tracking, or context-anchored retrieval.',
    inputSchema: {
      at_timestamp: z.number().describe('Unix epoch seconds for the point-in-time query. Use Date.now()/1000 for "now".'),
      domain: z.enum(['burnout','relationship','decision','code_pattern','contradiction','goal','general'])
        .optional()
        .describe('Filter by memory domain'),
      limit: z.number().min(1).max(50).optional().describe('Max results (default 10)'),
    },
  }, async ({ at_timestamp, domain, limit }) => {
    if (!SERVER_MODE) {
      return { content: [{ type: 'text' as const, text: '⚠️ timps_temporal_query requires SERVER mode (set TIMPS_URL). In LOCAL mode, use timps_get_memories.' }] };
    }
    const data = await timpsAPI('/chrono/query', 'POST', {
      userId: TIMPS_USER_ID,
      atTime: at_timestamp,
      domain,
      limit: limit ?? 10,
    });
    const nodes: any[] = data.nodes ?? [];
    if (!nodes.length) {
      return { content: [{ type: 'text' as const, text: `No valid memories found at t=${at_timestamp}.` }] };
    }
    const lines = [
      `**Temporal Query — ${new Date(at_timestamp * 1000).toISOString()}**`,
      `Valid memories: ${nodes.length}`,
      ...(data.causalChain?.length ? [`Causal chain root: ${data.causalChain.join(' → ')}`] : []),
      '',
      ...nodes.map((n: any, i: number) =>
        `${i + 1}. [${n.domain}] ${n.content} (importance: ${n.importanceScore?.toFixed(2)})`),
    ];
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  });

  registerTool('timps_chrono_foresight', {
    description:
      'Run a Monte-Carlo foresight simulation to predict future risk trajectories. ' +
      'Use for burnout prediction ("am I heading toward burnout?"), ' +
      'relationship drift warnings, decision regret risk, or recurring bug likelihood.',
    inputSchema: {
      domain: z.enum(['burnout','relationship','decision','code_pattern','contradiction','goal','general'])
        .describe('Which domain to simulate'),
      lookback_days: z.number().min(1).max(365).optional().describe('How many days of history to analyze (default 30)'),
      steps: z.number().min(3).max(20).optional().describe('Simulation steps (default 10)'),
    },
  }, async ({ domain, lookback_days, steps }) => {
    if (!SERVER_MODE) {
      return { content: [{ type: 'text' as const, text: '⚠️ timps_chrono_foresight requires SERVER mode (set TIMPS_URL). In LOCAL mode, use timps_burnout_analyze or timps_check_regret.' }] };
    }
    const data = await timpsAPI('/chrono/foresight', 'POST', {
      userId: TIMPS_USER_ID,
      domain,
      lookbackDays: lookback_days ?? 30,
      steps: steps ?? 10,
    });
    const r = data as {
      riskScore: number; riskLevel: string; explanation: string;
      trajectory: number[]; confidence: number; drivingNodeIds: string[];
    };
    const lines = [
      r.explanation,
      `Trajectory: [${r.trajectory.map((v: number) => Math.round(v * 100) + '%').join(', ')}]`,
      `Confidence: ${Math.round((r.confidence ?? 0) * 100)}%`,
      r.drivingNodeIds?.length ? `Top signals: ${r.drivingNodeIds.join(', ')}` : '',
    ].filter(Boolean);
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  });

  registerTool('timps_chrono_consolidate', {
    description:
      'Run the Ebbinghaus adaptive consolidation pass — prunes low-importance memories ' +
      'that have decayed below threshold while preserving causally important nodes. ' +
      'Use periodically to keep memory lean and relevant.',
    inputSchema: {
      importance_threshold: z.number().min(0).max(0.5).optional()
        .describe('Prune memories with effective score below this (default 0.05)'),
    },
  }, async ({ importance_threshold }) => {
    if (!SERVER_MODE) {
      return { content: [{ type: 'text' as const, text: '⚠️ timps_chrono_consolidate requires SERVER mode.' }] };
    }
    const data = await timpsAPI('/chrono/consolidate', 'POST', {
      userId: TIMPS_USER_ID,
      importanceThreshold: importance_threshold ?? 0.05,
    });
    return { content: [{ type: 'text' as const, text:
      `✓ ChronosForge consolidation complete.\nPruned: ${data.pruned ?? 0} memories\nRetained: ${data.retained ?? 0} memories` }] };
  });

  // ── Start ────────────────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`TIMPs MCP v1.0.0 → ${TIMPS_URL} (user ${TIMPS_USER_ID})`);
}

main().catch((err) => {
  console.error('TIMPs MCP failed:', err.message);
  process.exit(1);
});
