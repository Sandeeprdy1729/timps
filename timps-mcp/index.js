#!/usr/bin/env node
'use strict';

// Load env
require('dotenv').config();

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const TIMPS_URL = process.env.TIMPS_URL || 'http://localhost:3000';
const TIMPS_USER_ID = parseInt(process.env.TIMPS_USER_ID || '1', 10);

async function timpsAPI(path, method = 'GET', body) {
  const res = await fetch(`${TIMPS_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`TIMPs API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function chat(message, username) {
  const data = await timpsAPI('/chat', 'POST', {
    userId: TIMPS_USER_ID,
    username,
    message,
  });
  return data.response || 'No response from TIMPs';
}

async function main() {
  const server = new McpServer({ name: 'timps-mcp', version: '1.0.0' });

  // Core Memory
  server.registerTool('timps_chat', {
    description: 'Send a message to TIMPs with full memory context. Automatically activates contradiction detection, burnout analysis, bug patterns, and other intelligence tools.',
    inputSchema: {
      message: z.string().describe('Message to send to TIMPs'),
      username: z.string().optional().describe('Optional username'),
    },
  }, async ({ message, username }) => ({
    content: [{ type: 'text', text: await chat(message, username) }],
  }));

  server.registerTool('timps_get_memories', {
    description: 'Get all stored memories, goals, and preferences. Use before starting a complex task.',
    inputSchema: {},
  }, async () => {
    const data = await timpsAPI(`/memory/${TIMPS_USER_ID}`);
    const memories = data.memories || [];
    const goals = data.goals || [];
    if (!memories.length && !goals.length) {
      return { content: [{ type: 'text', text: 'No memories stored yet.' }] };
    }
    const lines = [
      `**Memories (${memories.length}):**`,
      ...memories.slice(0, 10).map(m => `- [${m.memory_type}] ${m.content} (importance: ${m.importance})`),
      `\n**Goals (${goals.length}):**`,
      ...goals.slice(0, 5).map(g => `- ${g.title}`),
    ];
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  server.registerTool('timps_store_memory', {
    description: 'Store an important fact in TIMPs long-term memory.',
    inputSchema: {
      content: z.string().describe('Memory to store'),
      importance: z.number().min(1).max(5).optional().describe('Importance 1-5'),
    },
  }, async ({ content, importance }) => {
    await chat(`Remember this (importance ${importance || 3}/5): ${content}`);
    return { content: [{ type: 'text', text: `✓ Stored: ${content}` }] };
  });

  // Contradiction Detection
  server.registerTool('timps_check_contradiction', {
    description: 'Check if a statement contradicts past positions. Use before any opinion or decision.',
    inputSchema: {
      text: z.string().describe('Statement to check for contradictions'),
    },
  }, async ({ text }) => {
    const data = await timpsAPI('/contradiction/check', 'POST', {
      userId: TIMPS_USER_ID, text, autoStore: true,
    });
    if (data.verdict === 'CONTRADICTION' || data.verdict === 'PARTIAL') {
      const score = Math.round((data.contradiction_score || 0) * 100);
      const claim = data.conflicting_position?.extracted_claim || 'a past position';
      const date = data.conflicting_position?.created_at
        ? new Date(data.conflicting_position.created_at).toLocaleDateString()
        : 'earlier';
      return { content: [{ type: 'text', text:
        `⚠️ CONTRADICTION (${score}%)\n\nNow: "${text}"\nPast (${date}): "${claim}"\n\nHave you changed your mind?`
      }] };
    }
    return { content: [{ type: 'text', text: `✓ No contradiction. Position stored.` }] };
  });

  server.registerTool('timps_get_positions', {
    description: 'List all tracked positions with conflict counts.',
    inputSchema: {},
  }, async () => {
    const data = await timpsAPI(`/positions/${TIMPS_USER_ID}`);
    const positions = data.positions || [];
    if (!positions.length) return { content: [{ type: 'text', text: 'No positions stored yet.' }] };
    const lines = [
      `**Positions (${data.total || positions.length}):**`,
      ...positions.slice(0, 15).map(p =>
        `- [${p.topic_cluster}] ${p.extracted_claim}${p.contradiction_count > 0 ? ` ⚠️ ${p.contradiction_count} conflict(s)` : ''}`
      ),
    ];
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  // Regret Oracle
  server.registerTool('timps_check_regret', {
    description: 'Warn before repeating a past regretted decision.',
    inputSchema: { decision: z.string().describe('Decision being considered') },
  }, async ({ decision }) => ({
    content: [{ type: 'text', text: await chat(`Regret Oracle: am I about to repeat a regretted decision? "${decision}"`) }],
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
    return { content: [{ type: 'text', text: `✓ Decision logged` }] };
  });

  // Burnout Seismograph
  server.registerTool('timps_burnout_analyze', {
    description: 'Analyze burnout risk vs personal baseline. Use when user mentions stress or exhaustion.',
    inputSchema: {},
  }, async () => ({
    content: [{ type: 'text', text: await chat('Burnout Seismograph: analyze my current risk vs personal baseline.') }],
  }));

  server.registerTool('timps_record_signal', {
    description: 'Log a behavioral signal for burnout tracking.',
    inputSchema: {
      signal_type: z.string().describe('focus_hours | energy_level | enthusiasm_score | commits_per_day'),
      value: z.number().describe('Signal value'),
    },
  }, async ({ signal_type, value }) => {
    await chat(`Record burnout signal: ${signal_type} = ${value}`);
    return { content: [{ type: 'text', text: `✓ Signal: ${signal_type} = ${value}` }] };
  });

  // Bug Pattern Prophet
  server.registerTool('timps_warn_bug_pattern', {
    description: 'Check if coding context matches personal bug triggers. Use before writing code under pressure.',
    inputSchema: { context: z.string().describe('Current coding context and conditions') },
  }, async ({ context }) => ({
    content: [{ type: 'text', text: await chat(`Bug Pattern Prophet: check my triggers for: ${context}`) }],
  }));

  server.registerTool('timps_record_bug', {
    description: 'Record a bug to build personal pattern profile.',
    inputSchema: {
      bug_type: z.string().describe('race_condition | null_pointer | off_by_one | memory_leak'),
      trigger_context: z.string().optional().describe('Context when bug appeared'),
    },
  }, async ({ bug_type, trigger_context }) => {
    await chat(`Record bug: ${bug_type}. Context: ${trigger_context || 'unknown'}`);
    return { content: [{ type: 'text', text: `✓ Bug recorded: ${bug_type}` }] };
  });

  // Tech Debt Seismograph
  server.registerTool('timps_check_tech_debt', {
    description: 'Check if code pattern matches past codebase incidents. Use during code review.',
    inputSchema: {
      pattern: z.string().describe('Code pattern or approach'),
      project_id: z.string().optional().describe('Project ID'),
    },
  }, async ({ pattern, project_id }) => ({
    content: [{ type: 'text', text: await chat(`Tech Debt Seismograph for ${project_id || 'default'}: "${pattern}"`) }],
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
    return { content: [{ type: 'text', text: `✓ Incident recorded` }] };
  });

  // API Archaeologist
  server.registerTool('timps_lookup_api', {
    description: 'Look up known quirks for an API before using it.',
    inputSchema: { api_name: z.string().describe('API name: Stripe, GitHub, etc.') },
  }, async ({ api_name }) => ({
    content: [{ type: 'text', text: await chat(`API Archaeologist: quirks for ${api_name}?`) }],
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
    return { content: [{ type: 'text', text: `✓ Saved: ${api_name} — ${quirk}` }] };
  });

  // Meeting Ghost
  server.registerTool('timps_extract_commitments', {
    description: 'Extract commitments from meeting notes. Use after any meeting.',
    inputSchema: {
      meeting_notes: z.string().describe('Raw meeting notes or transcript'),
      meeting_title: z.string().optional().describe('Meeting name'),
    },
  }, async ({ meeting_notes, meeting_title }) => ({
    content: [{ type: 'text', text: await chat(
      `Meeting Ghost: extract commitments from "${meeting_title || 'meeting'}":\n${meeting_notes}`
    ) }],
  }));

  server.registerTool('timps_get_pending_commitments', {
    description: 'List all pending commitments not yet completed.',
    inputSchema: {},
  }, async () => ({
    content: [{ type: 'text', text: await chat('Meeting Ghost: list all pending commitments.') }],
  }));

  // Relationship Intelligence
  server.registerTool('timps_relationship_check', {
    description: 'Check relationship health and drift alerts.',
    inputSchema: {
      contact_name: z.string().optional().describe('Person name — omit for all drift alerts'),
    },
  }, async ({ contact_name }) => ({
    content: [{ type: 'text', text: await chat(
      contact_name
        ? `Relationship Intelligence: health for ${contact_name}`
        : 'Relationship Intelligence: show all drift alerts'
    ) }],
  }));

  // Dead Reckoning
  server.registerTool('timps_simulate_decision', {
    description: 'Simulate future outcomes for a decision based on actual history.',
    inputSchema: {
      scenario: z.string().describe('Decision or situation to simulate'),
      horizon_months: z.number().optional().describe('Months ahead (default 12)'),
    },
  }, async ({ scenario, horizon_months }) => ({
    content: [{ type: 'text', text: await chat(
      `Dead Reckoning: simulate ${horizon_months || 12} months for: ${scenario}`
    ) }],
  }));

  // Living Manifesto
  server.registerTool('timps_get_manifesto', {
    description: 'Get the Living Manifesto — actual values from behavioral patterns, not stated beliefs.',
    inputSchema: {},
  }, async () => ({
    content: [{ type: 'text', text: await chat('Show my Living Manifesto.') }],
  }));

  // Connect
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`TIMPs MCP v1.0.0 → ${TIMPS_URL} (user ${TIMPS_USER_ID})`);
}

main().catch(err => {
  console.error('TIMPs MCP failed:', err.message);
  process.exit(1);
});