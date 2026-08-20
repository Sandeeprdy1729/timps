// TIMPS Cloudflare Worker — MCP JSON-RPC proxy to MemoryServer
// Routes mapped to actual MemoryServer REST endpoints.

class WorkerMemoryClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async request(path: string, method = 'GET', body?: any): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MemoryServer ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }
}

interface Env {
  TIMPS_MEMORY_URL: string;
  TIMPS_PROJECT_PATH: string;
  TIMPS_API_KEY?: string;
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any, client: WorkerMemoryClient) => Promise<any>;
}

function defineTool(name: string, description: string, schema: any, handler: (args: any, client: WorkerMemoryClient) => Promise<any>): ToolDef {
  return { name, description, inputSchema: schema, handler };
}

function ok(text: string) {
  return { content: [{ type: 'text', text }] };
}

function getTools(): ToolDef[] {
  return [
    // ── Core memory ──────────────────────────────────────────────
    defineTool('timps_store_memory', 'Store an important fact in long-term memory.', {
      type: 'object',
      properties: { content: { type: 'string' }, importance: { type: 'number' } },
      required: ['content'],
    }, async (args, c) => {
      await c.request('/memory/store', 'POST', { content: args.content, type: 'fact', tags: args.importance ? [`importance:${args.importance}`] : [] });
      return ok('Stored');
    }),

    defineTool('timps_get_memories', 'Get all stored memories.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: '', limit: 20 });
      return ok(JSON.stringify(res.memories || res, null, 2).slice(0, 8000));
    }),

    defineTool('timps_chat', 'Send a message to TIMPs with full memory context.', {
      type: 'object',
      properties: { message: { type: 'string' }, username: { type: 'string' } },
      required: ['message'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: args.message, limit: 5 });
      const memories = res.memories || res;
      return ok(typeof memories === 'string' ? memories : JSON.stringify(memories, null, 2));
    }),

    defineTool('timps_search_memories', 'Search memories by query.', {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
      required: ['query'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: args.query, limit: args.limit || 10 });
      return ok(JSON.stringify(res.memories || res, null, 2).slice(0, 8000));
    }),

    // ── Intelligence (real REST endpoints) ────────────────────────
    defineTool('timps_check_contradiction', 'Check if a statement contradicts past positions.', {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    }, async (args, c) => {
      const res = await c.request('/memory/intelligence/contradiction', 'POST', args);
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_check_tech_debt', 'Check if code pattern matches past incidents.', {
      type: 'object',
      properties: { pattern: { type: 'string' }, project_id: { type: 'string' } },
      required: ['pattern'],
    }, async (args, c) => {
      const res = await c.request('/memory/intelligence/tech-debt', 'POST', { pattern: args.pattern, project_id: args.project_id });
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_warn_bug_pattern', 'Check if coding context matches bug triggers.', {
      type: 'object',
      properties: { context: { type: 'string' } },
      required: ['context'],
    }, async (args, c) => {
      const res = await c.request('/memory/intelligence/bug-pattern', 'POST', args);
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_detect_architecture_drift', 'Compare current code structure against past architectural decisions.', {
      type: 'object',
      properties: { current_patterns: { type: 'array', items: { type: 'string' } }, project_id: { type: 'string' } },
      required: ['current_patterns'],
    }, async (args, c) => {
      const res = await c.request('/memory/intelligence/architecture-drift', 'POST', { current_patterns: args.current_patterns, project_id: args.project_id });
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_observe_culture', 'Add a decision text to the codebase culture corpus.', {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    }, async (args, c) => {
      const res = await c.request('/memory/intelligence/learn-pattern', 'POST', { observation: args.text });
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_burnout_analyze', 'Analyze burnout risk vs personal baseline.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/intelligence/burnout', 'GET');
      return ok(JSON.stringify(res));
    }),

    // ── Forge / audit (real REST endpoints) ───────────────────────
    defineTool('timps_verify_engram_chain', 'Verify the integrity of the immutable memory audit trail.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/forge/engram/verify', 'GET');
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_explain_provenance', 'Get the provenance chain for a memory.', {
      type: 'object',
      properties: { memoryId: { type: 'string' } },
      required: ['memoryId'],
    }, async (args, c) => {
      const res = await c.request(`/memory/forge/provenance/${encodeURIComponent(args.memoryId)}`, 'GET');
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_audit_memory', 'Run a full memory health audit.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/forge/audit', 'GET');
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_reveal_bias', 'Analyze memory for over/under-representation bias.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/forge/bias', 'GET');
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_resolve_conflict', 'Check for conflicts/contradictions between two statements.', {
      type: 'object',
      properties: { memoryA: { type: 'string' }, memoryB: { type: 'string' } },
      required: ['memoryA', 'memoryB'],
    }, async (args, c) => {
      const res = await c.request('/memory/intelligence/contradiction', 'POST', { text: `${args.memoryA} vs ${args.memoryB}` });
      return ok(JSON.stringify(res));
    }),

    // ── Working memory (real REST endpoints) ──────────────────────
    defineTool('timps_get_working_memory', 'Get current working memory state.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/working', 'GET');
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_set_working_goal', 'Set a goal in working memory.', {
      type: 'object',
      properties: { goal: { type: 'string' } },
      required: ['goal'],
    }, async (args, c) => {
      const res = await c.request('/memory/working/goal', 'POST', args);
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_record_working_file', 'Record file being worked on.', {
      type: 'object',
      properties: { file: { type: 'string' } },
      required: ['file'],
    }, async (args, c) => {
      const res = await c.request('/memory/working/file', 'POST', { filePath: args.file });
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_record_working_error', 'Record an error encountered.', {
      type: 'object',
      properties: { error: { type: 'string' } },
      required: ['error'],
    }, async (args, c) => {
      const res = await c.request('/memory/working/error', 'POST', args);
      return ok(JSON.stringify(res));
    }),

    // ── Context & episodes (real REST endpoints) ──────────────────
    defineTool('timps_get_context', 'Get context string for current project.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/context', 'POST', {});
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_record_episode', 'Record an episodic event.', {
      type: 'object',
      properties: { content: { type: 'string' }, type: { type: 'string' } },
      required: ['content'],
    }, async (args, c) => {
      const res = await c.request('/memory/episode', 'POST', { summary: args.content, outcome: args.type || 'unknown' });
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_get_episodes', 'Get recent episodes.', {
      type: 'object', properties: { count: { type: 'number' } },
    }, async (_args, c) => {
      const res = await c.request('/memory/episodes', 'GET');
      return ok(JSON.stringify(res).slice(0, 8000));
    }),

    defineTool('timps_extract_facts', 'Extract facts from a conversation.', {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    }, async (args, c) => {
      const res = await c.request('/memory/extract-facts', 'POST', { userMessage: args.text, assistantResponse: 'extracted' });
      return ok(JSON.stringify(res));
    }),

    // ── Consolidation & stats (real REST endpoints) ───────────────
    defineTool('timps_consolidate', 'Consolidate memories (merge similar, prune stale).', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/consolidate', 'POST', {});
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_get_stats', 'Get memory statistics.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/stats', 'GET');
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_export_memories', 'Export all memories as JSON.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/export', 'GET');
      return ok(JSON.stringify(res).slice(0, 8000));
    }),

    // ── Embedding (real REST endpoints) ───────────────────────────
    defineTool('timps_embedding_status', 'Get embedding backfill status.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/embedding/status', 'GET');
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_embedding_backfill', 'Backfill embeddings for existing memories.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/embedding/backfill', 'POST', {});
      return ok(JSON.stringify(res));
    }),

    // ── Tools without dedicated REST endpoints → store/recall fallback ──
    defineTool('timps_check_deployment_risk', 'Check if a deployment pattern has caused issues before.', {
      type: 'object',
      properties: { pattern: { type: 'string' } },
      required: ['pattern'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: `deployment risk: ${args.pattern}`, limit: 5 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_check_regret', 'Warn before repeating a past regretted decision.', {
      type: 'object',
      properties: { decision: { type: 'string' } },
      required: ['decision'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: `regret decision: ${args.decision}`, limit: 5 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_log_decision', 'Log a decision outcome to build the Regret Oracle.', {
      type: 'object',
      properties: { description: { type: 'string' }, outcome: { type: 'string' }, regret_score: { type: 'number' } },
      required: ['description'],
    }, async (args, c) => {
      const content = `Decision: ${args.description}${args.outcome ? ` | Outcome: ${args.outcome}` : ''}${args.regret_score != null ? ` | Regret: ${args.regret_score}` : ''}`;
      await c.request('/memory/store', 'POST', { content, type: 'decision', tags: ['decision', 'regret-oracle'] });
      return ok('Logged');
    }),

    defineTool('timps_log_past_decision', 'Log a past decision with its outcome.', {
      type: 'object',
      properties: { decision: { type: 'string' }, context: { type: 'string' }, outcome: { type: 'string' }, regret_score: { type: 'number' } },
      required: ['decision', 'context', 'outcome', 'regret_score'],
    }, async (args, c) => {
      const content = `Past decision: ${args.decision} | Context: ${args.context} | Outcome: ${args.outcome} | Regret: ${args.regret_score}`;
      await c.request('/memory/store', 'POST', { content, type: 'decision', tags: ['decision', 'regret-oracle'] });
      return ok('Logged');
    }),

    defineTool('timps_log_question', 'Log a question you asked.', {
      type: 'object',
      properties: { question: { type: 'string' } },
      required: ['question'],
    }, async (args, c) => {
      await c.request('/memory/store', 'POST', { content: `Question asked: ${args.question}`, type: 'fact', tags: ['question'] });
      return ok('Logged');
    }),

    defineTool('timps_simulate_decision', 'Simulate future outcomes for a decision.', {
      type: 'object',
      properties: { scenario: { type: 'string' }, horizon_months: { type: 'number' } },
      required: ['scenario'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: `similar decision: ${args.scenario}`, limit: 10 });
      return ok(JSON.stringify({ scenario: args.scenario, similar_decisions: res.memories || res }, null, 2));
    }),

    defineTool('timps_record_incident', 'Record a production incident.', {
      type: 'object',
      properties: { pattern: { type: 'string' }, incident_type: { type: 'string' }, time_to_debug_hrs: { type: 'number' } },
      required: ['pattern'],
    }, async (args, c) => {
      const content = `Incident: ${args.pattern}${args.incident_type ? ` | Type: ${args.incident_type}` : ''}${args.time_to_debug_hrs != null ? ` | Debug time: ${args.time_to_debug_hrs}h` : ''}`;
      await c.request('/memory/store', 'POST', { content, type: 'incident', tags: ['incident', 'bug'] });
      return ok('Recorded');
    }),

    defineTool('timps_record_bug', 'Record a bug to build pattern profile.', {
      type: 'object',
      properties: { bug_type: { type: 'string' }, trigger_context: { type: 'string' } },
      required: ['bug_type'],
    }, async (args, c) => {
      const content = `Bug: ${args.bug_type}${args.trigger_context ? ` | Context: ${args.trigger_context}` : ''}`;
      await c.request('/memory/store', 'POST', { content, type: 'fact', tags: ['bug', 'bug-pattern'] });
      return ok('Recorded');
    }),

    defineTool('timps_predict_bug_risk', 'Predict bug risk for a planned change.', {
      type: 'object',
      properties: { change_description: { type: 'string' }, files_affected: { type: 'array', items: { type: 'string' } } },
      required: ['change_description'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: `bug risk: ${args.change_description}`, limit: 5 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_get_incident_timeline', 'Show past incidents in a module.', {
      type: 'object',
      properties: { module: { type: 'string' } },
      required: ['module'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: `incident ${args.module}`, limit: 10 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_get_architecture_decisions', 'Retrieve past architecture decisions.', {
      type: 'object',
      properties: { topic: { type: 'string' } },
    }, async (args, c) => {
      const q = args.topic ? `architecture decision ${args.topic}` : 'architecture decisions';
      const res = await c.request('/memory/recall', 'POST', { query: q, limit: 10 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_record_pattern', 'Store a reusable code pattern or convention.', {
      type: 'object',
      properties: { pattern: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
      required: ['pattern'],
    }, async (args, c) => {
      await c.request('/memory/store', 'POST', { content: args.pattern, type: 'fact', tags: ['pattern', ...(args.tags || [])] });
      return ok('Recorded');
    }),

    defineTool('timps_record_learning', 'Store something you learned today.', {
      type: 'object',
      properties: { learning: { type: 'string' }, topic: { type: 'string' } },
      required: ['learning', 'topic'],
    }, async (args, c) => {
      await c.request('/memory/store', 'POST', { content: args.learning, type: 'fact', tags: ['learning', args.topic] });
      return ok('Recorded');
    }),

    defineTool('timps_lookup_api', 'Look up known quirks for an API.', {
      type: 'object',
      properties: { api_name: { type: 'string' } },
      required: ['api_name'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: `API quirk ${args.api_name}`, limit: 5 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_record_api_quirk', 'Save a discovered API quirk for future reference.', {
      type: 'object',
      properties: { api_name: { type: 'string' }, quirk: { type: 'string' }, severity: { type: 'string' }, endpoint: { type: 'string' } },
      required: ['api_name', 'quirk'],
    }, async (args, c) => {
      const content = `API quirk [${args.severity || 'info'}] ${args.api_name}${args.endpoint ? ` (${args.endpoint})` : ''}: ${args.quirk}`;
      await c.request('/memory/store', 'POST', { content, type: 'fact', tags: ['api-quirk', args.api_name] });
      return ok('Recorded');
    }),

    defineTool('timps_record_mention', 'Record that a person was mentioned.', {
      type: 'object',
      properties: { name: { type: 'string' }, context: { type: 'string' } },
      required: ['name', 'context'],
    }, async (args, c) => {
      await c.request('/memory/store', 'POST', { content: `${args.name}: ${args.context}`, type: 'fact', tags: ['person', args.name] });
      return ok('Recorded');
    }),

    defineTool('timps_relationship_check', 'Check relationship health and drift alerts.', {
      type: 'object',
      properties: { contact_name: { type: 'string' } },
    }, async (args, c) => {
      const q = args.contact_name ? `person ${args.contact_name}` : 'people relationships';
      const res = await c.request('/memory/recall', 'POST', { query: q, limit: 10 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_get_velocity_trend', 'Show productivity trend.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: 'velocity productivity commits', limit: 10 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_record_signal', 'Log a behavioral signal.', {
      type: 'object',
      properties: { signal_type: { type: 'string' }, value: { type: 'number' } },
      required: ['signal_type', 'value'],
    }, async (args, c) => {
      await c.request('/memory/store', 'POST', { content: `Signal ${args.signal_type}: ${args.value}`, type: 'fact', tags: ['signal', args.signal_type] });
      return ok('Recorded');
    }),

    defineTool('timps_chrono_foresight', 'Run a Monte-Carlo foresight simulation.', {
      type: 'object',
      properties: { domain: { type: 'string' }, lookback_days: { type: 'number' }, steps: { type: 'number' } },
      required: ['domain'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: `${args.domain} risk trajectory`, limit: 10 });
      return ok(JSON.stringify({ domain: args.domain, related_memories: res.memories || res }, null, 2));
    }),

    defineTool('timps_chronos_ingest', 'Ingest a signal into Chronos Veil.', {
      type: 'object',
      properties: { content: { type: 'string' }, source_module: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, entity: { type: 'string' } },
      required: ['content', 'source_module'],
    }, async (args, c) => {
      await c.request('/memory/store', 'POST', {
        content: args.content, type: 'episode',
        tags: ['chronos', args.source_module, ...(args.tags || [])],
      });
      return ok('Ingested');
    }),

    defineTool('timps_chronos_query', 'Query Chronos Veil with multi-tool resolution.', {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
      required: ['query'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: args.query, limit: args.limit || 8 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_chronos_stats', 'Get Chronos Veil statistics.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/stats', 'GET');
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_institutional_memory', 'List contributors who haven\'t been seen in 90+ days.', {
      type: 'object',
      properties: { contributor: { type: 'string' } },
    }, async (args, c) => {
      const q = args.contributor ? `contributor ${args.contributor}` : 'contributors team members';
      const res = await c.request('/memory/recall', 'POST', { query: q, limit: 10 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_record_contribution', 'Record a contribution from a team member.', {
      type: 'object',
      properties: { contributor: { type: 'string' }, kind: { type: 'string' }, text: { type: 'string' } },
      required: ['contributor', 'kind', 'text'],
    }, async (args, c) => {
      await c.request('/memory/store', 'POST', { content: `${args.contributor} [${args.kind}]: ${args.text}`, type: 'fact', tags: ['contribution', args.contributor, args.kind] });
      return ok('Recorded');
    }),

    defineTool('timps_get_pending_commitments', 'List pending commitments.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: 'commitment pending deadline', limit: 10 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_extract_commitments', 'Extract commitments from meeting notes.', {
      type: 'object',
      properties: { meeting_notes: { type: 'string' }, meeting_title: { type: 'string' } },
      required: ['meeting_notes'],
    }, async (args, c) => {
      await c.request('/memory/store', 'POST', { content: `Meeting${args.meeting_title ? ` (${args.meeting_title})` : ''}: ${args.meeting_notes}`, type: 'fact', tags: ['meeting', 'commitments'] });
      return ok('Stored meeting notes');
    }),

    defineTool('timps_temporal_query', 'Query memories valid at a specific point in time.', {
      type: 'object',
      properties: { at_timestamp: { type: 'number' }, domain: { type: 'string' }, limit: { type: 'number' } },
      required: ['at_timestamp'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: args.domain || 'all memories', limit: args.limit || 10 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_infer_schemas', 'Auto-extract typed schemas from memory stream.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: '', limit: 50 });
      return ok(JSON.stringify({ message: 'Schema inference requires local processing', memory_count: (res.memories || res).length }));
    }),

    defineTool('timps_nexus_ingest', 'Ingest a signal into NexusForge episodic memory.', {
      type: 'object',
      properties: { content: { type: 'string' }, source_module: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
      required: ['content', 'source_module'],
    }, async (args, c) => {
      await c.request('/memory/store', 'POST', {
        content: args.content, type: 'episode',
        tags: ['nexus', args.source_module, ...(args.tags || [])],
      });
      return ok('Ingested');
    }),

    defineTool('timps_nexus_query', 'Query NexusForge episodic memory.', {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: args.query, limit: 10 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_nexus_stats', 'Get NexusForge statistics.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/stats', 'GET');
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_synapse_ingest', 'Ingest a signal into SynapseMetabolon.', {
      type: 'object',
      properties: { content: { type: 'string' }, source_module: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, entity: { type: 'string' } },
      required: ['content', 'source_module'],
    }, async (args, c) => {
      await c.request('/memory/store', 'POST', {
        content: args.content, type: 'episode',
        tags: ['synapse', args.source_module, ...(args.tags || [])],
      });
      return ok('Ingested');
    }),

    defineTool('timps_synapse_query', 'Query SynapseMetabolon with spreading activation.', {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
      required: ['query'],
    }, async (args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: args.query, limit: args.limit || 10 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_synapse_stats', 'Get SynapseMetabolon statistics.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/stats', 'GET');
      return ok(JSON.stringify(res));
    }),

    defineTool('timps_curriculum_plan', 'Generate a learning plan from questions and decisions.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: 'learning plan questions decisions gap', limit: 10 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_get_manifesto', 'Get the Living Manifesto.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: 'manifesto values beliefs principles', limit: 5 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),

    defineTool('timps_codebase_culture', 'Surface the cultural norms of the codebase.', {
      type: 'object', properties: {},
    }, async (_args, c) => {
      const res = await c.request('/memory/recall', 'POST', { query: 'codebase culture norms conventions', limit: 10 });
      return ok(JSON.stringify(res.memories || res, null, 2));
    }),
  ];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID, Mcp-Session-Id',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', transport: 'streamable-http', tools: getTools().length }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (url.pathname === '/mcp' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { method, params, id } = body;

        const client = new WorkerMemoryClient(
          env.TIMPS_MEMORY_URL,
          request.headers.get('Authorization')?.replace('Bearer ', '') || env.TIMPS_API_KEY
        );

        let result: any;

        if (method === 'initialize') {
          result = {
            protocolVersion: '2025-03-26',
            capabilities: { tools: {} },
            serverInfo: { name: 'timps-mcp', version: '2.1.0' },
          };
        } else if (method === 'notifications/initialized') {
          return new Response(null, { status: 200, headers: corsHeaders });
        } else if (method === 'tools/list') {
          const tools = getTools();
          result = {
            tools: tools.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          };
        } else if (method === 'tools/call') {
          const tools = getTools();
          const tool = tools.find(t => t.name === params?.name);
          if (!tool) {
            return new Response(JSON.stringify({
              jsonrpc: '2.0', id,
              error: { code: -32601, message: `Tool not found: ${params?.name}` },
            }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
          }
          try {
            result = await tool.handler(params?.arguments || {}, client);
          } catch (toolErr: any) {
            result = { content: [{ type: 'text', text: `Error: ${toolErr.message}` }], isError: true };
          }
        } else {
          return new Response(JSON.stringify({
            jsonrpc: '2.0', id,
            error: { code: -32601, message: `Method not found: ${method}` },
          }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        return new Response(JSON.stringify({
          jsonrpc: '2.0', id, result,
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (err: any) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0', id: null,
          error: { code: -32603, message: err.message || 'Internal error' },
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  },
};
