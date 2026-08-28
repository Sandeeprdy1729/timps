import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Memory } from './memory.js';
import type { Message } from '../config/types.js';

interface SessionData {
  messages: Message[];
  timestamp: number;
  totalUsage?: Record<string, number>;
  model?: string;
  provider?: string;
}

export class SessionIngestionPipeline {
  private memory: Memory;

  constructor(memory: Memory) {
    this.memory = memory;
  }

  ingestSessionFile(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) return false;
      const raw = fs.readFileSync(filePath, 'utf-8');
      const session: SessionData = JSON.parse(raw);
      if (!session.messages || !Array.isArray(session.messages) || session.messages.length === 0) return false;
      this.processMessages(session.messages);
      return true;
    } catch {
      return false;
    }
  }

  ingestMessages(messages: Message[]): void {
    this.processMessages(messages);
  }

  private processMessages(messages: Message[]): void {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const allText = messages.map(m => m.content).filter(Boolean).join('\n\n');
    const userText = userMessages.map(m => m.content).filter(Boolean).join('\n\n');
    const assistantText = assistantMessages.map(m => m.content).filter(Boolean).join('\n\n');
    const turnCount = Math.min(userMessages.length, assistantMessages.length);

    if (allText.length < 50) return;

    this.feedL1Working(allText);
    this.feedL2Episodic(messages, turnCount);
    this.feedL3Semantic(userText, assistantText);
    this.buildConversationGraph(messages);
    this.feedL4Procedural(messages);
    this.feedL5ChronosForge(allText);
    this.feedL7EchoForge(allText);
    this.feedL8SynapseQuench(allText);
    this.feedL9SheafWeaver(allText);
    this.feedL10AetherForgeERL(allText);
    this.feedL11SupraSheaf(allText);
    this.feedL12QPTW(allText);
    this.feedL13TitanicForge(allText);
    this.feedL14QERW(allText);
    this.feedL15QISRD(allText);
    this.feedL17EclipseForge(allText);
    this.feedL18QITRL(allText);
    this.feedOperationalLayers(allText, messages);
    this.feedIntelligenceTools(allText, messages);
  }

  private feedL1Working(allText: string): void {
    try { this.memory.setGoal(allText.slice(0, 500)); } catch { /* best-effort */ }
  }

  private feedL2Episodic(messages: Message[], turnCount: number): void {
    const userMessages = messages.filter(m => m.role === 'user');
    const fullSummary = userMessages.map(m => m.content).filter(Boolean).join(' → ');
    const toolsUsed = new Set<string>();
    const filesChanged = new Set<string>();
    for (const m of messages) {
      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          toolsUsed.add(tc.name);
          const args = tc.arguments;
          if (typeof args === 'object' && args) {
            if (typeof (args as any).path === 'string') filesChanged.add(String((args as any).path));
            if (typeof (args as any).filePath === 'string') filesChanged.add(String((args as any).filePath));
          }
        }
      }
    }
    try {
      this.memory.storeEpisode({
        timestamp: Date.now(),
        summary: fullSummary,
        filesChanged: [...filesChanged],
        toolsUsed: [...toolsUsed],
        outcome: 'success',
        complexity: turnCount > 10 ? 'high' : turnCount > 3 ? 'medium' : 'low',
      });
    } catch { /* best-effort */ }
  }

  private feedL3Semantic(userText: string, assistantText: string): void {
    const parts: string[] = [];
    if (userText.length > 50) parts.push(`[User] ${userText}`);
    if (assistantText.length > 50) parts.push(`[Assistant] ${assistantText}`);
    for (const text of parts) {
      try { this.memory.storeFact(text, 'pattern', ['session']); } catch { /* best-effort */ }
    }
  }

  private buildConversationGraph(messages: Message[]): void {
    const userMsgs = messages.filter(m => m.role === 'user');
    const assistantMsgs = messages.filter(m => m.role === 'assistant');

    for (let i = 0; i < Math.min(userMsgs.length, assistantMsgs.length); i++) {
      try {
        this.memory.extractFacts(userMsgs[i].content, assistantMsgs[i].content);
        this.memory.extractEntities(userMsgs[i].content, assistantMsgs[i].content);
      } catch { /* best-effort */ }
    }

    // Feed assistant responses to intelligence tools for pattern learning
    for (const msg of assistantMsgs) {
      try { this.memory.patternLearner.learn(msg.content, ['session']); } catch { /* best-effort */ }
    }

    // Record user mentions via RelationshipIntelligence
    const userText = userMsgs.map(m => m.content).filter(Boolean).join(' ');
    const nameMatch = userText.match(/\b[A-Z][a-z]+\b/g);
    if (nameMatch) {
      for (const name of nameMatch.slice(0, 3)) {
        try { this.memory.relationshipIntelligence.recordMention(name, userText.slice(0, 200)); } catch { /* best-effort */ }
      }
    }

    // Feed to InstitutionalMemory
    try {
      const allText = messages.map(m => m.content).filter(Boolean).join('\n\n');
      this.memory.institutionalMemory.record('session', 'decision', allText.slice(0, 500));
    } catch { /* best-effort */ }
  }

  private INGESTED_MARKER_FILE = path.join(os.homedir(), '.timps', 'ingested-sessions.json');

  private getIngestedMarkers(): Set<string> {
    try {
      if (fs.existsSync(this.INGESTED_MARKER_FILE)) {
        return new Set(JSON.parse(fs.readFileSync(this.INGESTED_MARKER_FILE, 'utf-8')));
      }
    } catch { /* ignore */ }
    return new Set();
  }

  private markIngested(filePath: string): void {
    try {
      const markers = this.getIngestedMarkers();
      markers.add(filePath);
      fs.mkdirSync(path.dirname(this.INGESTED_MARKER_FILE), { recursive: true });
      fs.writeFileSync(this.INGESTED_MARKER_FILE, JSON.stringify([...markers]), 'utf-8');
    } catch { /* best-effort */ }
  }

  ingestPastSessions(sessionsBaseDir: string): { ingested: number; skipped: number; failed: number } {
    let ingested = 0;
    let skipped = 0;
    let failed = 0;
    const markers = this.getIngestedMarkers();

    try {
      if (!fs.existsSync(sessionsBaseDir)) return { ingested, skipped, failed };
      const entries = fs.readdirSync(sessionsBaseDir);
      for (const entry of entries) {
        const sessionDir = path.join(sessionsBaseDir, entry);
        try {
          if (!fs.statSync(sessionDir).isDirectory()) continue;

          const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.json'));
          for (const file of files) {
            const filePath = path.join(sessionDir, file);
            if (markers.has(filePath)) { skipped++; continue; }
            try {
              const raw = fs.readFileSync(filePath, 'utf-8');
              const data = JSON.parse(raw);
              if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
                this.processMessages(data.messages);
                this.markIngested(filePath);
                ingested++;
              } else failed++;
            } catch { failed++; }
          }
        } catch { failed++; }
      }
    } catch { /* base dir may not exist */ }
    return { ingested, skipped, failed };
  }

  private feedL4Procedural(messages: Message[]): void {
    try {
      const tools = messages.flatMap(m => m.toolCalls || []).map(tc => ({ tool: tc.name, args: {} }));
      if (tools.length > 0) {
        this.memory.procedural.extractFromExecution(
          `Session with ${messages.length} messages`,
          'general',
          tools,
          'success'
        );
      }
    } catch { /* best-effort */ }
  }

  private feedL5ChronosForge(allText: string): void {
    try {
      const chronos = this.memory.chronosVeil;
      if (chronos) chronos.ingest(allText, 'conversation', ['session', 'full'], undefined, 'general');
    } catch { /* best-effort */ }
  }

  private feedL7EchoForge(allText: string): void {
    try {
      const echo = this.memory.echoVeil;
      if (echo) echo.weave(allText, { domain: 'general' as any, tags: ['session', 'full'] });
    } catch { /* best-effort */ }
  }

  private feedL8SynapseQuench(allText: string): void {
    try { this.memory.synapseQuench.weave(allText); } catch { /* best-effort */ }
  }

  private feedL9SheafWeaver(allText: string): void {
    try { this.memory.sheafWeaver.weave(allText); } catch { /* best-effort */ }
  }

  private feedL10AetherForgeERL(allText: string): void {
    try {
      const aether = this.memory.aetherForge;
      if (aether) aether.weave(allText, { domain: 'general' as any, tags: ['session', 'full'] });
    } catch { /* best-effort */ }
  }

  private feedL11SupraSheaf(allText: string): void {
    try { this.memory.supraSheaf.buildSupraGraph(); } catch { /* best-effort */ }
  }

  private feedL12QPTW(allText: string): void {
    try { this.memory.qptw.weave(allText); } catch { /* best-effort */ }
  }

  private feedL13TitanicForge(allText: string): void {
    try { this.memory.titanicForge.weave(allText); } catch { /* best-effort */ }
  }

  private feedL14QERW(allText: string): void {
    try { this.memory.qerw.weave(allText); } catch { /* best-effort */ }
  }

  private feedL15QISRD(allText: string): void {
    try { this.memory.qisrd.weave(allText); } catch { /* best-effort */ }
  }

  private feedL17EclipseForge(allText: string): void {
    try { this.memory.eclipseForge.weave(allText); } catch { /* best-effort */ }
  }

  private feedL18QITRL(allText: string): void {
    try { this.memory.qitrl.weave(allText); } catch { /* best-effort */ }
  }

  private feedOperationalLayers(allText: string, messages: Message[]): void {
    try {
      this.memory.engramLog.append({
        op: 'store', layerId: 'session-ingestion', entryId: `session_${Date.now()}`,
        actorId: 'agent', timestamp: Date.now(), payload: { length: allText.length },
        justification: 'post-session ingestion',
      });
    } catch { /* best-effort */ }

    try { this.memory.consolidationEngine.run({ sinceMs: undefined, dryRun: false }); } catch { /* best-effort */ }

    try { this.memory.synapticPruner.sweep(); } catch { /* best-effort */ }

    try {
      this.memory.provenanceForge.record({
        sourceKind: 'user_direct', sourceDetail: 'session-ingestion',
        actorId: 'agent', observedAt: Date.now(), evidenceCount: messages.length,
        confidence: 0.8, parentIds: [], actor: 'agent',
      });
    } catch { /* best-effort */ }

    try { this.memory.spacedRepetitionForge.schedule('session-' + Date.now(), true); } catch { /* best-effort */ }

    try { this.memory.constitutionalGuard.evaluate(allText, null, 0); } catch { /* best-effort */ }

    try { this.memory.auditForge.run(); } catch { /* best-effort */ }

    try {
      this.memory.prospectiveTrigger.evaluate(allText);
    } catch { /* best-effort */ }

    try { this.memory.biasRevealer.reveal(); } catch { /* best-effort */ }

    try {
      this.memory.contextVector.capture({
        domain: 'general', activeFiles: [], tags: ['session', 'full'],
        timeOfDay: new Date().getHours(), dayOfWeek: new Date().getDay(),
      });
    } catch { /* best-effort */ }

    try { this.memory.rehearsalEngine.enqueue(allText, 'session', `session_${Date.now()}`); } catch { /* best-effort */ }

    try { this.memory.schemaDistorter.learn(allText); } catch { /* best-effort */ }

    try {
      this.memory.confidenceCalibrator.calibrate({
        similarity: 0.7, reliability: 0.6, evidence: Math.min(messages.length / 10, 1), freshness: 1,
      });
    } catch { /* best-effort */ }
  }

  private feedIntelligenceTools(allText: string, messages: Message[]): void {
    const toolCount = messages.filter(m => m.toolCalls?.length).length;
    const toolNames = [...new Set(messages.flatMap(m => m.toolCalls || []).map(tc => tc.name))];

    // ── 9 original tools ──

    try { this.memory.patternLearner.learn(allText, ['session-conversation']); } catch { /* best-effort */ }

    try {
      const contra = this.memory.contradiction;
      for (const m of messages) {
        if (m.role === 'user' && m.content.length > 20) {
          contra.check(m.content, false);
        }
      }
    } catch { /* best-effort */ }

    try {
      for (const tool of toolNames) {
        this.memory.velocityTracker.observe(tool, `Used in session with ${messages.length} messages`, 0.5);
      }
    } catch { /* best-effort */ }

    try {
      this.memory.architectureDrift.recordInsight('convention', allText.slice(0, 500), 'default', 'conversation');
    } catch { /* best-effort */ }

    try {
      const lower = allText.toLowerCase();
      for (const kw of ['bug', 'error', 'fix', 'issue', 'crash', 'exception', 'fail']) {
        if (lower.includes(kw)) { this.memory.bugPattern.recordBug(kw, allText.slice(0, 500)); break; }
      }
    } catch { /* best-effort */ }

    try {
      const lower = allText.toLowerCase();
      for (const kw of ['api', 'endpoint', 'route', 'request', 'response', 'fetch']) {
        if (lower.includes(kw)) { this.memory.apiArchaeologist.recordQuirk(kw, allText.slice(0, 500)); break; }
      }
    } catch { /* best-effort */ }

    try {
      this.memory.burnoutSeismograph.record('messages', messages.length);
      this.memory.burnoutSeismograph.record('tool_calls', toolCount);
    } catch { /* best-effort */ }

    try { this.memory.regretOracle.log(`Session with ${messages.length} messages`, 'completed', 0, 'session'); } catch { /* best-effort */ }

    try { this.memory.techDebt.recordIncident(toolNames.join(', '), allText.slice(0, 500)); } catch { /* best-effort */ }

    // ── 13 new intelligence tools ──

    try { this.memory.falseMemoryDetector.score({ evidenceCount: messages.length, ageDays: 0 }); } catch { /* best-effort */ }

    try { this.memory.sourceAttributor.attribute(`session_${Date.now()}`); } catch { /* best-effort */ }

    try { this.memory.meetingGhost.extract(allText, 'session-conversation'); } catch { /* best-effort */ }

    try { this.memory.deadReckoning.log('Session completed', allText.slice(0, 300), 0, 'neutral'); } catch { /* best-effort */ }

    try { this.memory.livingManifesto.ingest(allText); } catch { /* best-effort */ }

    try { this.memory.relationshipIntelligence.recordMention('user', allText.slice(0, 200)); } catch { /* best-effort */ }

    try { this.memory.skillShadow.shadow(allText.slice(0, 500)); } catch { /* best-effort */ }

    try { this.memory.curriculumArchitect.logQuestion(allText.slice(0, 500)); } catch { /* best-effort */ }

    try { this.memory.codebaseAnthropologist.observe(allText); } catch { /* best-effort */ }

    try { this.memory.institutionalMemory.record('agent', 'decision', allText.slice(0, 500)); } catch { /* best-effort */ }

    try { this.memory.schemaInferrer.infer(); } catch { /* best-effort */ }

    try { this.memory.memoryAuditor.audit(); } catch { /* best-effort */ }
  }

  ingestLatestSession(sessionDir: string): boolean {
    return this.ingestSessionFile(sessionDir + '/latest.json');
  }

  ingestAllSessions(sessionsDir: string): { ingested: number; failed: number } {
    let ingested = 0;
    let failed = 0;
    try {
      const entries = fs.readdirSync(sessionsDir);
      for (const entry of entries) {
        const full = sessionsDir + '/' + entry;
        try {
          if (fs.statSync(full).isDirectory()) {
            const latestFile = full + '/latest.json';
            if (fs.existsSync(latestFile) && this.ingestSessionFile(latestFile)) ingested++;
            else {
              const msgsFile = full + '/messages.json';
              if (fs.existsSync(msgsFile) && this.ingestSessionFile(msgsFile)) ingested++;
              else failed++;
            }
          } else if (entry.endsWith('.json')) {
            if (this.ingestSessionFile(full)) ingested++;
            else failed++;
          }
        } catch { failed++; }
      }
    } catch { /* sessions dir may not exist */ }
    return { ingested, failed };
  }
}
