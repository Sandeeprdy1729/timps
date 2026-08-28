import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface ToolContext {
  memoryClient: any;
  SERVER_MODE: boolean;
}

function registerWorkerTools(server: McpServer, ctx: ToolContext): void {
  const { memoryClient, SERVER_MODE } = ctx;
  const registerTool = server.registerTool.bind(server) as (
    name: string,
    config: { description: string; inputSchema: Record<string, unknown> },
    handler: (args: any) => any
  ) => void;

  // Core Memory
  registerTool('timps_chat', {
    description: 'Send a message to TIMPs with full memory context.',
    inputSchema: {
      message: z.string().describe('Message to send to TIMPs'),
      username: z.string().optional().describe('Optional username'),
    },
  }, async ({ message, username }) => {
    const res = await memoryClient.request('/api/chat', 'POST', { message, username });
    return { content: [{ type: 'text' as const, text: res.response || 'No response' }] };
  });

  registerTool('timps_get_memories', {
    description: 'Get all stored memories, goals, and preferences.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.recall('', { limit: 10 });
    return { content: [{ type: 'text' as const, text: JSON.stringify(res.memories || res) }] };
  });

  registerTool('timps_store_memory', {
    description: 'Store an important fact in long-term memory.',
    inputSchema: {
      content: z.string().describe('Memory to store'),
      importance: z.number().min(1).max(5).optional().describe('Importance 1-5'),
    },
  }, async ({ content, importance }) => {
    const res = await memoryClient.store(content, { importance });
    return { content: [{ type: 'text' as const, text: `Stored: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_check_contradiction', {
    description: 'Check if a statement contradicts past positions.',
    inputSchema: {
      text: z.string().describe('Statement to check'),
    },
  }, async ({ text }) => {
    const res = await memoryClient.checkContradiction(text);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_check_deployment_risk', {
    description: 'Check if a deployment pattern has caused issues before.',
    inputSchema: {
      pattern: z.string().describe('Deployment approach'),
    },
  }, async ({ pattern }) => {
    const res = await memoryClient.checkDeploymentRisk(pattern);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_check_regret', {
    description: 'Warn before repeating a past regretted decision.',
    inputSchema: {
      decision: z.string().describe('Decision being considered'),
    },
  }, async ({ decision }) => {
    const res = await memoryClient.checkRegret(decision);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_check_tech_debt', {
    description: 'Check if code pattern matches past incidents.',
    inputSchema: {
      pattern: z.string().describe('Code pattern'),
      projectId: z.string().optional().describe('Project ID'),
    },
  }, async ({ pattern, projectId }) => {
    const res = await memoryClient.checkTechDebt(pattern, projectId);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_log_decision', {
    description: 'Log a decision outcome to build Regret Oracle.',
    inputSchema: {
      description: z.string().describe('The decision made'),
      outcome: z.string().optional().describe('What happened'),
      regretScore: z.number().min(0).max(1).optional().describe('Regret 0-1'),
    },
  }, async ({ description, outcome, regretScore }) => {
    const res = await memoryClient.logDecision(description, outcome, regretScore);
    return { content: [{ type: 'text' as const, text: `Logged: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_log_past_decision', {
    description: 'Log a past decision with outcome.',
    inputSchema: {
      decision: z.string().describe('The decision'),
      context: z.string().describe('Context'),
      outcome: z.enum(['positive', 'neutral', 'negative']).describe('Outcome'),
      regretScore: z.number().min(0).max(1).describe('Regret 0-1'),
    },
  }, async ({ decision, context, outcome, regretScore }) => {
    const res = await memoryClient.logPastDecision(decision, context, outcome, regretScore);
    return { content: [{ type: 'text' as const, text: `Logged: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_log_question', {
    description: 'Log a question you asked.',
    inputSchema: {
      question: z.string().describe('The question'),
    },
  }, async ({ question }) => {
    const res = await memoryClient.logQuestion(question);
    return { content: [{ type: 'text' as const, text: `Logged: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_simulate_decision', {
    description: 'Simulate future outcomes for a decision.',
    inputSchema: {
      scenario: z.string().describe('Decision to simulate'),
      horizonMonths: z.number().optional().describe('Months ahead'),
    },
  }, async ({ scenario, horizonMonths }) => {
    const res = await memoryClient.simulateDecision(scenario, horizonMonths);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_record_incident', {
    description: 'Record a production incident.',
    inputSchema: {
      pattern: z.string().describe('Code pattern that caused incident'),
      incidentType: z.string().describe('Incident type'),
      timeToDebugHrs: z.number().optional().describe('Debug hours'),
    },
  }, async ({ pattern, incidentType, timeToDebugHrs }) => {
    const res = await memoryClient.recordIncident(pattern, incidentType, timeToDebugHrs);
    return { content: [{ type: 'text' as const, text: `Recorded: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_record_bug', {
    description: 'Record a bug to build pattern profile.',
    inputSchema: {
      bugType: z.string().describe('Bug type'),
      triggerContext: z.string().optional().describe('Context'),
    },
  }, async ({ bugType, triggerContext }) => {
    const res = await memoryClient.recordBug(bugType, triggerContext);
    return { content: [{ type: 'text' as const, text: `Recorded: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_warn_bug_pattern', {
    description: 'Check if coding context matches personal bug triggers.',
    inputSchema: {
      context: z.string().describe('Current coding context'),
    },
  }, async ({ context }) => {
    const res = await memoryClient.warnBugPattern(context);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_predict_bug_risk', {
    description: 'Predict bug risk for a planned change.',
    inputSchema: {
      changeDescription: z.string().describe('What you are about to change'),
      filesAffected: z.array(z.string()).optional().describe('Files affected'),
    },
  }, async ({ changeDescription, filesAffected }) => {
    const res = await memoryClient.predictBugRisk(changeDescription, filesAffected);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_get_incident_timeline', {
    description: 'Show past incidents in a module.',
    inputSchema: {
      module: z.string().describe('Module name'),
    },
  }, async ({ module }) => {
    const res = await memoryClient.getIncidentTimeline(module);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_get_architecture_decisions', {
    description: 'Retrieve past architecture decisions.',
    inputSchema: {
      topic: z.string().optional().describe('Filter by topic'),
    },
  }, async ({ topic }) => {
    const res = await memoryClient.getArchitectureDecisions(topic);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_observe_culture', {
    description: 'Add a decision to codebase culture corpus.',
    inputSchema: {
      text: z.string().describe('Decision text'),
    },
  }, async ({ text }) => {
    const res = await memoryClient.observeCulture(text);
    return { content: [{ type: 'text' as const, text: `Observed: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_ingest_manifesto_signal', {
    description: 'Add behavioral observation to manifesto.',
    inputSchema: {
      text: z.string().describe('Behavioral signal'),
    },
  }, async ({ text }) => {
    const res = await memoryClient.ingestManifestoSignal(text);
    return { content: [{ type: 'text' as const, text: `Ingested: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_get_manifesto', {
    description: 'Get the Living Manifesto.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.getManifesto();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_record_pattern', {
    description: 'Store a reusable code pattern.',
    inputSchema: {
      pattern: z.string().describe('The pattern'),
      tags: z.array(z.string()).optional().describe('Tags'),
    },
  }, async ({ pattern, tags }) => {
    const res = await memoryClient.recordPattern(pattern, tags);
    return { content: [{ type: 'text' as const, text: `Recorded: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_get_code_patterns', {
    description: 'Retrieve personal coding patterns.',
    inputSchema: {
      context: z.string().optional().describe('Filter by context'),
    },
  }, async ({ context }) => {
    const res = await memoryClient.getCodePatterns(context);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_record_learning', {
    description: 'Store something you learned.',
    inputSchema: {
      learning: z.string().describe('What you learned'),
      topic: z.string().describe('Topic'),
    },
  }, async ({ learning, topic }) => {
    const res = await memoryClient.recordLearning(learning, topic);
    return { content: [{ type: 'text' as const, text: `Recorded: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_lookup_api', {
    description: 'Look up known quirks for an API.',
    inputSchema: {
      apiName: z.string().describe('API name'),
    },
  }, async ({ apiName }) => {
    const res = await memoryClient.lookupApi(apiName);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_record_api_quirk', {
    description: 'Save a discovered API quirk.',
    inputSchema: {
      apiName: z.string().describe('API name'),
      quirk: z.string().describe('The quirk'),
      severity: z.enum(['info', 'warning', 'critical']).describe('Severity'),
      endpoint: z.string().optional().describe('Endpoint'),
    },
  }, async ({ apiName, quirk, severity, endpoint }) => {
    const res = await memoryClient.recordApiQuirk(apiName, quirk, severity, endpoint);
    return { content: [{ type: 'text' as const, text: `Recorded: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_record_mention', {
    description: 'Record a person mention.',
    inputSchema: {
      name: z.string().describe('Person name'),
      context: z.string().describe('Context'),
    },
  }, async ({ name, context }) => {
    const res = await memoryClient.recordMention(name, context);
    return { content: [{ type: 'text' as const, text: `Recorded: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_relationship_check', {
    description: 'Check relationship health.',
    inputSchema: {
      contactName: z.string().optional().describe('Contact name'),
    },
  }, async ({ contactName }) => {
    const res = await memoryClient.relationshipCheck(contactName);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_get_velocity_trend', {
    description: 'Show productivity trend.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.getVelocityTrend();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_record_signal', {
    description: 'Log a behavioral signal for burnout tracking.',
    inputSchema: {
      signalType: z.string().describe('Signal type'),
      value: z.number().describe('Signal value'),
    },
  }, async ({ signalType, value }) => {
    const res = await memoryClient.recordSignal(signalType, value);
    return { content: [{ type: 'text' as const, text: `Recorded: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_chrono_foresight', {
    description: 'Run Monte-Carlo foresight simulation.',
    inputSchema: {
      domain: z.enum(['burnout', 'relationship', 'decision', 'code_pattern', 'contradiction', 'goal', 'general']).describe('Domain'),
      lookbackDays: z.number().optional().describe('Days back'),
      steps: z.number().optional().describe('Simulation steps'),
    },
  }, async ({ domain, lookbackDays, steps }) => {
    const res = await memoryClient.chronoForesight(domain, lookbackDays, steps);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_chrono_consolidate', {
    description: 'Run Ebbinghaus consolidation.',
    inputSchema: {
      importanceThreshold: z.number().optional().describe('Threshold'),
    },
  }, async ({ importanceThreshold }) => {
    const res = await memoryClient.chronoConsolidate(importanceThreshold);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_chronos_ingest', {
    description: 'Ingest signal into Chronos Veil.',
    inputSchema: {
      content: z.string().describe('Content'),
      sourceModule: z.string().describe('Source'),
      tags: z.array(z.string()).optional().describe('Tags'),
      entity: z.string().optional().describe('Entity'),
    },
  }, async ({ content, sourceModule, tags, entity }) => {
    const res = await memoryClient.chronoIngest(content, sourceModule, tags, entity);
    return { content: [{ type: 'text' as const, text: `Ingested: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_chronos_query', {
    description: 'Query Chronos Veil.',
    inputSchema: {
      query: z.string().describe('Query'),
      limit: z.number().optional().describe('Max results'),
    },
  }, async ({ query, limit }) => {
    const res = await memoryClient.chronoQuery(query, limit);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_chronos_stats', {
    description: 'Get Chronos Veil statistics.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.chronoStats();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_detect_architecture_drift', {
    description: 'Compare current code against past decisions.',
    inputSchema: {
      currentPatterns: z.array(z.string()).describe('Current patterns'),
      projectId: z.string().optional().describe('Project ID'),
    },
  }, async ({ currentPatterns, projectId }) => {
    const res = await memoryClient.detectArchitectureDrift(currentPatterns, projectId);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_institutional_memory', {
    description: 'List dormant contributors.',
    inputSchema: {
      contributor: z.string().optional().describe('Specific contributor'),
    },
  }, async ({ contributor }) => {
    const res = await memoryClient.institutionalMemory(contributor);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_mark_contributor_active', {
    description: 'Mark contributor active.',
    inputSchema: {
      contributor: z.string().describe('Name'),
      date: z.string().optional().describe('Date'),
    },
  }, async ({ contributor, date }) => {
    const res = await memoryClient.markContributorActive(contributor, date);
    return { content: [{ type: 'text' as const, text: `Marked: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_record_contribution', {
    description: 'Record a contribution.',
    inputSchema: {
      contributor: z.string().describe('Name'),
      kind: z.enum(['decision', 'pattern', 'incident', 'quirk', 'position']).describe('Kind'),
      text: z.string().describe('Text'),
    },
  }, async ({ contributor, kind, text }) => {
    const res = await memoryClient.recordContribution(contributor, kind, text);
    return { content: [{ type: 'text' as const, text: `Recorded: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_get_pending_commitments', {
    description: 'List pending commitments.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.getPendingCommitments();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_complete_commitment', {
    description: 'Mark commitment complete.',
    inputSchema: {
      idPrefix: z.string().describe('ID prefix'),
    },
  }, async ({ idPrefix }) => {
    const res = await memoryClient.completeCommitment(idPrefix);
    return { content: [{ type: 'text' as const, text: `Completed: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_extract_commitments', {
    description: 'Extract commitments from meeting notes.',
    inputSchema: {
      meetingNotes: z.string().describe('Meeting notes'),
      meetingTitle: z.string().optional().describe('Title'),
    },
  }, async ({ meetingNotes, meetingTitle }) => {
    const res = await memoryClient.extractCommitments(meetingNotes, meetingTitle);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_register_trigger', {
    description: 'Register a prospective trigger.',
    inputSchema: {
      when: z.string().describe('Trigger phrase'),
      surface: z.string().describe('What to surface'),
      memoryId: z.string().describe('Memory ID'),
    },
  }, async ({ when, surface, memoryId }) => {
    const res = await memoryClient.registerTrigger(when, surface, memoryId);
    return { content: [{ type: 'text' as const, text: `Registered: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_resolve_conflict', {
    description: 'Check for conflicts between memories.',
    inputSchema: {
      memoryA: z.string().describe('First memory'),
      memoryB: z.string().describe('Second memory'),
    },
  }, async ({ memoryA, memoryB }) => {
    const res = await memoryClient.resolveConflict(memoryA, memoryB);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_temporal_query', {
    description: 'Query memories at a point in time.',
    inputSchema: {
      atTimestamp: z.number().describe('Unix timestamp'),
      domain: z.string().optional().describe('Domain'),
      limit: z.number().optional().describe('Max results'),
    },
  }, async ({ atTimestamp, domain, limit }) => {
    const res = await memoryClient.temporalQuery(atTimestamp, domain, limit);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_verify_engram_chain', {
    description: 'Verify immutable audit trail.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.verifyEngramChain();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_explain_provenance', {
    description: 'Get provenance chain for a memory.',
    inputSchema: {
      memoryId: z.string().describe('Memory ID'),
    },
  }, async ({ memoryId }) => {
    const res = await memoryClient.explainProvenance(memoryId);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_audit_memory', {
    description: 'Run full memory health audit.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.auditMemory();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_reveal_bias', {
    description: 'Analyze memory for bias.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.revealBias();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_infer_schemas', {
    description: 'Auto-extract typed schemas from memory.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.inferSchemas();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_nexus_graph', {
    description: 'Get episodic graph structure.',
    inputSchema: {
      limit: z.number().optional().describe('Max nodes'),
    },
  }, async ({ limit }) => {
    const res = await memoryClient.getNexusGraph(limit);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_nexus_ingest', {
    description: 'Ingest into NexusForge.',
    inputSchema: {
      content: z.string().describe('Content'),
      sourceModule: z.string().describe('Source'),
      tags: z.array(z.string()).optional().describe('Tags'),
    },
  }, async ({ content, sourceModule, tags }) => {
    const res = await memoryClient.nexusIngest(content, sourceModule, tags);
    return { content: [{ type: 'text' as const, text: `Ingested: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_nexus_query', {
    description: 'Query NexusForge episodic memory.',
    inputSchema: {
      query: z.string().describe('Query'),
    },
  }, async ({ query }) => {
    const res = await memoryClient.nexusQuery(query);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_nexus_stats', {
    description: 'Get NexusForge statistics.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.nexusStats();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_synapse_graph', {
    description: 'Get metabolic graph structure.',
    inputSchema: {
      limit: z.number().optional().describe('Max nodes'),
    },
  }, async ({ limit }) => {
    const res = await memoryClient.getSynapseGraph(limit);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_synapse_consolidate', {
    description: 'Run metabolic consolidation.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.synapseConsolidate();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_synapse_ingest', {
    description: 'Ingest into SynapseMetabolon.',
    inputSchema: {
      content: z.string().describe('Content'),
      sourceModule: z.string().describe('Source'),
      tags: z.array(z.string()).optional().describe('Tags'),
      entity: z.string().optional().describe('Entity'),
    },
  }, async ({ content, sourceModule, tags, entity }) => {
    const res = await memoryClient.synapseIngest(content, sourceModule, tags, entity);
    return { content: [{ type: 'text' as const, text: `Ingested: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_synapse_query', {
    description: 'Query SynapseMetabolon.',
    inputSchema: {
      query: z.string().describe('Query'),
      limit: z.number().optional().describe('Max results'),
    },
  }, async ({ query, limit }) => {
    const res = await memoryClient.synapseQuery(query, limit);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_synapse_stats', {
    description: 'Get SynapseMetabolon statistics.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.synapseStats();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_curriculum_plan', {
    description: 'Generate learning plan.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.curriculumPlan();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_get_session_history', {
    description: 'Get recent session history.',
    inputSchema: {
      daysBack: z.number().optional().describe('Days back'),
    },
  }, async ({ daysBack }) => {
    const res = await memoryClient.getSessionHistory(daysBack);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_burnout_analyze', {
    description: 'Analyze burnout risk.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.burnoutAnalyze();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_skill_shadow', {
    description: 'Coach using observed workflow patterns.',
    inputSchema: {
      situation: z.string().describe('Situation'),
    },
  }, async ({ situation }) => {
    const res = await memoryClient.skillShadow(situation);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_false_memory_check', {
    description: 'Score false memory risk.',
    inputSchema: {
      content: z.string().describe('Content'),
      evidenceCount: z.number().describe('Evidence count'),
      ageDays: z.number().describe('Age in days'),
    },
  }, async ({ content, evidenceCount, ageDays }) => {
    const res = await memoryClient.falseMemoryCheck(content, evidenceCount, ageDays);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_get_shared_decisions', {
    description: 'Get team-level architecture decisions.',
    inputSchema: {
      topic: z.string().optional().describe('Topic'),
    },
  }, async ({ topic }) => {
    const res = await memoryClient.getSharedDecisions(topic);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_record_review_pattern', {
    description: 'Store review pattern.',
    inputSchema: {
      pattern: z.string().describe('Pattern'),
      severity: z.enum(['info', 'warning', 'blocker']).describe('Severity'),
    },
  }, async ({ pattern, severity }) => {
    const res = await memoryClient.recordReviewPattern(pattern, severity);
    return { content: [{ type: 'text' as const, text: `Recorded: ${res.id || 'ok'}` }] };
  });

  registerTool('timps_get_patterns_for_context', {
    description: 'Get patterns for current context.',
    inputSchema: {
      filePath: z.string().describe('File path'),
      taskDescription: z.string().describe('Task description'),
    },
  }, async ({ filePath, taskDescription }) => {
    const res = await memoryClient.getPatternsForContext(filePath, taskDescription);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_get_context_switches', {
    description: 'Count context switches.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.getContextMenuSwitches();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });

  registerTool('timps_codebase_culture', {
    description: 'Surface codebase cultural norms.',
    inputSchema: {},
  }, async () => {
    const res = await memoryClient.getManifesto();
    return { content: [{ type: 'text' as const, text: JSON.stringify(res) }] };
  });
}

export { registerWorkerTools };
