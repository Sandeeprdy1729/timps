#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config();

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { z } from 'zod';

const TIMPS_URL = process.env.TIMPS_URL || 'http://localhost:3000';
const TIMPS_USER_ID = parseInt(process.env.TIMPS_USER_ID || '1', 10);

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

  // ── Core Memory ─────────────────────────────────────────────────────────────

  server.registerTool('timps_chat', {
    description: 'Send a message to TIMPs with full memory context. Automatically activates contradiction detection, burnout analysis, bug patterns, and other intelligence tools.',
    inputSchema: {
      message: z.string().describe('Message to send to TIMPs'),
      username: z.string().optional().describe('Optional username'),
    },
  }, async ({ message, username }) => ({
    content: [{ type: 'text' as const, text: await chat(message, username) }],
  }));

  server.registerTool('timps_get_memories', {
    description: 'Get all stored memories, goals, and preferences. Use before starting a complex task.',
    inputSchema: {},
  }, async () => {
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

  server.registerTool('timps_store_memory', {
    description: 'Store an important fact in TIMPs long-term memory.',
    inputSchema: {
      content: z.string().describe('Memory to store'),
      importance: z.number().min(1).max(5).optional().describe('Importance 1-5'),
    },
  }, async ({ content, importance }) => {
    await chat(`Remember this (importance ${importance || 3}/5): ${content}`);
    return { content: [{ type: 'text' as const, text: `✓ Stored: ${content}` }] };
  });

  // ── Contradiction Detection ──────────────────────────────────────────────────

  server.registerTool('timps_check_contradiction', {
    description: 'Check if a statement contradicts past positions. Use before any opinion or decision.',
    inputSchema: {
      text: z.string().describe('Statement to check'),
    },
  }, async ({ text }) => {
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

  server.registerTool('timps_get_positions', {
    description: 'List all tracked positions with conflict counts.',
    inputSchema: {},
  }, async () => {
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

  server.registerTool('timps_check_regret', {
    description: 'Warn before repeating a past regretted decision.',
    inputSchema: { decision: z.string().describe('Decision being considered') },
  }, async ({ decision }) => ({
    content: [{ type: 'text' as const, text: await chat(`Regret Oracle: am I about to repeat a regretted decision? "${decision}"`) }],
  }));

  server.registerTool('timps_log_decision', {
    description: 'Log a decision outcome to build the Regret Oracle knowledge base.',
    inputSchema: {
      description: z.string().describe('The decision made'),
      outcome: z.string().optional().describe('What happened'),
      regret_score: z.number().min(0).max(1).optional().describe('Regret 0-1'),
    },
  }, async ({ description, outcome, regret_score }) => {
    await chat(`Log decision: "${description}". Outcome: ${outcome || 'unknown'}. Regret: ${regret_score ?? 0}`);
    return { content: [{ type: 'text' as const, text: `✓ Decision logged` }] };
  });

  // ── Burnout Seismograph ──────────────────────────────────────────────────────

  server.registerTool('timps_burnout_analyze', {
    description: 'Analyze burnout risk vs personal baseline. Use when user mentions stress or exhaustion.',
    inputSchema: {},
  }, async () => ({
    content: [{ type: 'text' as const, text: await chat('Burnout Seismograph: analyze my current risk vs personal baseline.') }],
  }));

  server.registerTool('timps_record_signal', {
    description: 'Log a behavioral signal for burnout tracking.',
    inputSchema: {
      signal_type: z.string().describe('focus_hours | energy_level | enthusiasm_score | commits_per_day'),
      value: z.number().describe('Signal value'),
    },
  }, async ({ signal_type, value }) => {
    await chat(`Record burnout signal: ${signal_type} = ${value}`);
    return { content: [{ type: 'text' as const, text: `✓ Signal: ${signal_type} = ${value}` }] };
  });

  // ── Bug Pattern Prophet ──────────────────────────────────────────────────────

  server.registerTool('timps_warn_bug_pattern', {
    description: 'Check if coding context matches personal bug triggers. Use before writing code under pressure.',
    inputSchema: { context: z.string().describe('Current coding context and conditions') },
  }, async ({ context }) => ({
    content: [{ type: 'text' as const, text: await chat(`Bug Pattern Prophet: check my triggers for: ${context}`) }],
  }));

  server.registerTool('timps_record_bug', {
    description: 'Record a bug to build personal pattern profile.',
    inputSchema: {
      bug_type: z.string().describe('race_condition | null_pointer | off_by_one | memory_leak | etc.'),
      trigger_context: z.string().optional().describe('Context when bug appeared'),
    },
  }, async ({ bug_type, trigger_context }) => {
    await chat(`Record bug: ${bug_type}. Context: ${trigger_context || 'unknown'}`);
    return { content: [{ type: 'text' as const, text: `✓ Bug recorded: ${bug_type}` }] };
  });

  // ── Tech Debt Seismograph ────────────────────────────────────────────────────

  server.registerTool('timps_check_tech_debt', {
    description: 'Check if code pattern matches past codebase incidents. Use during code review.',
    inputSchema: {
      pattern: z.string().describe('Code pattern or approach'),
      project_id: z.string().optional().describe('Project ID'),
    },
  }, async ({ pattern, project_id }) => ({
    content: [{ type: 'text' as const, text: await chat(`Tech Debt Seismograph for ${project_id || 'default'}: "${pattern}"`) }],
  }));

  server.registerTool('timps_record_incident', {
    description: 'Record a production incident to build pattern library.',
    inputSchema: {
      pattern: z.string().describe('Code pattern that caused the incident'),
      incident_type: z.string().optional().describe('Incident type'),
      time_to_debug_hrs: z.number().optional().describe('Debug hours'),
    },
  }, async ({ pattern, incident_type, time_to_debug_hrs }) => {
    await chat(`Record incident: "${pattern}", type: ${incident_type || 'unknown'}, hours: ${time_to_debug_hrs || '?'}`);
    return { content: [{ type: 'text' as const, text: `✓ Incident recorded` }] };
  });

  // ── API Archaeologist ────────────────────────────────────────────────────────

  server.registerTool('timps_lookup_api', {
    description: 'Look up known quirks for an API before using it.',
    inputSchema: { api_name: z.string().describe('API name: Stripe, GitHub, etc.') },
  }, async ({ api_name }) => ({
    content: [{ type: 'text' as const, text: await chat(`API Archaeologist: quirks for ${api_name}?`) }],
  }));

  server.registerTool('timps_record_api_quirk', {
    description: 'Save a discovered API quirk for future reference.',
    inputSchema: {
      api_name: z.string().describe('API name'),
      endpoint: z.string().optional().describe('Specific endpoint'),
      quirk: z.string().describe('The undocumented behavior'),
      severity: z.enum(['info', 'warning', 'critical']).optional(),
    },
  }, async ({ api_name, endpoint, quirk, severity }) => {
    await chat(`Save API quirk for ${api_name}${endpoint ? ` (${endpoint})` : ''}: ${quirk}. Severity: ${severity || 'info'}`);
    return { content: [{ type: 'text' as const, text: `✓ Saved: ${api_name} — ${quirk}` }] };
  });

  // ── Meeting Ghost ────────────────────────────────────────────────────────────

  server.registerTool('timps_extract_commitments', {
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

  server.registerTool('timps_get_pending_commitments', {
    description: 'List all pending commitments not yet completed.',
    inputSchema: {},
  }, async () => ({
    content: [{ type: 'text' as const, text: await chat('Meeting Ghost: list all pending commitments.') }],
  }));

  // ── Relationship Intelligence ────────────────────────────────────────────────

  server.registerTool('timps_relationship_check', {
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

  server.registerTool('timps_simulate_decision', {
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

  server.registerTool('timps_get_manifesto', {
    description: 'Get the Living Manifesto — actual values from behavioral patterns, not stated beliefs.',
    inputSchema: {},
  }, async () => ({
    content: [{ type: 'text' as const, text: await chat('Show my Living Manifesto.') }],
  }));

  // ── Chronos Veil (Temporal Apex Veil) ─────────────────────────────────────

  server.registerTool('timps_chronos_ingest', {
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

  server.registerTool('timps_chronos_query', {
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

  server.registerTool('timps_chronos_stats', {
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

  server.registerTool('timps_nexus_ingest', {
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

  server.registerTool('timps_nexus_query', {
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

  server.registerTool('timps_nexus_stats', {
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

  server.registerTool('timps_nexus_graph', {
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

  server.registerTool('timps_synapse_ingest', {
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

  server.registerTool('timps_synapse_query', {
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

  server.registerTool('timps_synapse_stats', {
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

  server.registerTool('timps_synapse_graph', {
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

  server.registerTool('timps_synapse_consolidate', {
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

  // ── Start ────────────────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`TIMPs MCP v1.0.0 → ${TIMPS_URL} (user ${TIMPS_USER_ID})`);
}

main().catch((err) => {
  console.error('TIMPs MCP failed:', err.message);
  process.exit(1);
});