import * as path from 'node:path';
import * as fs from 'node:fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { MemoryEngine } from '../MemoryEngine';
import type {
  MemoryEntry as MEMemoryEntry,
  ScoredMemoryEntry as MEScoredMemoryEntry,
  ConflictEvent,
  ConflictResolutionAction,
} from '../types';
import { generateId } from '../storage';

const pendingConflicts = new Map<string, ConflictEvent>();

function findProtoFile(): string {
  const candidates = [
    path.resolve(__dirname, '../../proto/timps/memory/v1/memory.proto'),
    path.resolve(process.cwd(), 'proto/timps/memory/v1/memory.proto'),
    path.resolve(__dirname, '../../../proto/timps/memory/v1/memory.proto'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const PROTO_PATH = findProtoFile();

// defaults: false — no implicit empty objects for oneof/unset messages.
// arrays: true    — repeated fields default to [] instead of undefined.
// objects: false  — message fields default to undefined (not {}) when unset.
const PROTO_OPTIONS: protoLoader.Options = {
  keepCase: false,
  longs: Number,
  enums: String,
  defaults: false,
  arrays: true,
  objects: false,
  oneofs: true,
  includeDirs: [
    path.dirname(path.dirname(path.dirname(path.dirname(PROTO_PATH)))),
  ],
};

export interface GrpcServerOptions {
  port?: number;
  host?: string;
  credentials?: grpc.ServerCredentials;
  maxReceiveMessageLength?: number;
  maxSendMessageLength?: number;
}

function toScoredProto(e: MEScoredMemoryEntry): any {
  return {
    entry: {
      id: e.id,
      timestamp: e.timestamp,
      type: e.type,
      content: e.content,
      tags: e.tags ?? [],
      score: e.score ?? 0,
    },
    calibrated_confidence: (e as any).calibratedConfidence ?? 0.5,
    false_memory_risk: (e as any).falseMemoryRisk ?? 0,
    source_reliability: (e as any).sourceReliability ?? 0.5,
    source_kind: (e as any).sourceKind ?? 'unknown',
    context_boost: (e as any).contextBoost ?? 0,
    rehearsal_boost: (e as any).rehearsalBoost ?? 0,
  };
}

function fromProtoEpisodic(e: any): any {
  return {
    timestamp: e.timestamp ?? Date.now(),
    summary: e.summary ?? '',
    outcome: e.outcome ?? 'unknown',
    durationMs: e.duration_ms || undefined,
    errorCount: e.error_count || undefined,
    tags: e.tags ?? [],
  };
}

function memoryEntryToProto(e: MEMemoryEntry): any {
  return {
    id: e.id,
    timestamp: e.timestamp,
    type: e.type,
    content: e.content,
    tags: e.tags ?? [],
    score: e.score ?? 0,
  };
}

export function createGrpcServer(engine: MemoryEngine, options: GrpcServerOptions = {}) {
  const port = options.port ?? 4101;
  const host = options.host ?? '0.0.0.0';

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, PROTO_OPTIONS);
  const proto = grpc.loadPackageDefinition(packageDefinition) as any;

  const server = new grpc.Server({
    'grpc.max_receive_message_length': options.maxReceiveMessageLength ?? 4 * 1024 * 1024,
    'grpc.max_send_message_length': options.maxSendMessageLength ?? 4 * 1024 * 1024,
  });

  // ── Service Implementation ───────────────────────────────────────────────
  const serviceImpl = {
    // ── Core Memory Operations ──
    Store: (call: any, callback: any) => {
      try {
        const req = call.request;
        const { type, tags, user_id, project_id } = req;
        // oneof: exactly one of content or episode is set
        const content: string | undefined = req.content;
        const episode: any = req.episode;

        if (episode) {
          engine.storeEpisode(fromProtoEpisodic(episode));
          callback(null, { status: 'ok', kind: 'episode' });
        } else if (content) {
          // Phase 2d: Synchronous conflict detection at write time
          const conflictResult = (engine as any).contradiction?.checkBeforeStore(
            { content, type: type ?? 'fact', tags: tags ?? [] } as MEMemoryEntry,
            engine.getSemanticEntries(),
          );
          if (conflictResult?.hasConflict) {
            const conflictId = generateId('conflict');
            const conflict: ConflictEvent = {
              conflictId,
              projectId: project_id ?? 'default',
              agentAId: conflictResult.conflictingEntry?.actorId ?? 'unknown',
              agentBId: user_id ?? 'anonymous',
              entryA: conflictResult.conflictingEntry!,
              entryB: { content, type: type ?? 'fact', tags: tags ?? [] } as MEMemoryEntry,
              similarity: conflictResult.similarity,
              detectedAt: Date.now(),
              suggestedResolution: conflictResult.explanation,
              status: 'pending',
            };
            pendingConflicts.set(conflictId, conflict);
            callback(null, {
              status: 'conflict',
              kind: 'conflict',
              conflict_id: conflictId,
              message: conflictResult.explanation,
            });
            return;
          }
          engine.store({ content, type: type ?? 'fact', tags: tags ?? [] });
          callback(null, { status: 'ok', kind: 'semantic' });
        } else {
          callback({ code: grpc.status.INVALID_ARGUMENT, message: 'content or episode required' });
        }
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    Recall: async (call: any, callback: any) => {
      try {
        const req = call.request;
        const results = await engine.recall(req.query, {
          limit: req.limit || 10,
          type: req.type || undefined,
          tags: req.tags?.length ? req.tags : undefined,
          minConfidence: req.min_confidence || undefined,
          maxFalseMemoryRisk: req.max_false_memory_risk || undefined,
          useIntelligence: true,
        });
        callback(null, {
          results: results.map(toScoredProto),
          count: results.length,
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    GetStats: (_call: any, callback: any) => {
      try {
        const stats = engine.getStats();
        callback(null, {
          semantic_count: stats.semanticCount,
          episode_count: stats.episodeCount,
          working_files: stats.workingFiles,
          working_patterns: stats.workingPatterns,
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    DeleteMemory: (call: any, callback: any) => {
      try {
        const { id, content } = call.request;
        const entries: MEMemoryEntry[] = engine.getSemanticEntries();
        let deleted = 0;
        let filtered = entries;
        if (id) {
          filtered = entries.filter((e: any) => e.id !== id);
          deleted = entries.length - filtered.length;
        } else if (content) {
          filtered = entries.filter((e: any) => !e.content.includes(content));
          deleted = entries.length - filtered.length;
        }
        if (deleted > 0) {
          engine.saveSemanticEntries(filtered);
        }
        callback(null, { status: deleted > 0 ? 'ok' : 'not_found', deleted });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    GetWorking: (_call: any, callback: any) => {
      try {
        const wm = engine.workingMemory;
        callback(null, {
          current_goal: wm.currentGoal ?? '',
          active_files: wm.activeFiles ?? [],
          recent_errors: wm.recentErrors ?? [],
          discovered_patterns: wm.discoveredPatterns ?? [],
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    SetGoal: (call: any, callback: any) => {
      try {
        engine.setGoal(call.request.goal);
        callback(null, { status: 'ok', kind: 'goal' });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    TrackFile: (call: any, callback: any) => {
      try {
        engine.trackFile(call.request.file_path);
        callback(null, { status: 'ok', kind: 'file' });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    TrackError: (call: any, callback: any) => {
      try {
        engine.trackError(call.request.error);
        callback(null, { status: 'ok', kind: 'error' });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ClearWorking: (_call: any, callback: any) => {
      try {
        engine.clearWorking();
        callback(null, { status: 'ok', kind: 'working' });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    GetContext: (call: any, callback: any) => {
      try {
        const context = engine.getContextString(call.request.task ?? '');
        callback(null, { context });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    StoreEpisode: (call: any, callback: any) => {
      try {
        const req = call.request;
        engine.storeEpisode(fromProtoEpisodic(req));
        callback(null, { status: 'ok', kind: 'episode' });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    LoadEpisodes: (call: any, callback: any) => {
      try {
        const count = call.request.count || 10;
        const episodes = engine.loadEpisodes(count) as any[];
        callback(null, {
          episodes: episodes.map((e: any) => ({
            id: e.id,
            timestamp: e.timestamp,
            summary: e.summary,
            outcome: e.outcome,
            duration_ms: e.durationMs ?? 0,
            error_count: e.errorCount ?? 0,
            tags: e.tags ?? [],
          })),
          count: episodes.length,
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ExtractFacts: (call: any, callback: any) => {
      try {
        const { user_message, assistant_response } = call.request;
        engine.extractFacts(user_message, assistant_response);
        callback(null, { status: 'ok', kind: 'facts' });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    Consolidate: (call: any, callback: any) => {
      try {
        const removed = engine.consolidate();
        callback(null, { added_semantic: 0, added_episodic: 0, skipped_duplicates: removed });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ExportMemory: async (_call: any, callback: any) => {
      try {
        const pack = await engine.export() as any;
        callback(null, {
          version: pack.version ?? '1.0',
          project_hash: pack.projectHash ?? '',
          exported_at: pack.exportedAt ?? Date.now(),
          working: {
            current_goal: pack.working?.currentGoal ?? '',
            active_files: pack.working?.activeFiles ?? [],
            recent_errors: pack.working?.recentErrors ?? [],
            discovered_patterns: pack.working?.discoveredPatterns ?? [],
          },
          episodic: (pack.episodic ?? []).map((e: any) => ({
            id: e.id, timestamp: e.timestamp, summary: e.summary,
            outcome: e.outcome, duration_ms: e.durationMs ?? 0,
            error_count: e.errorCount ?? 0, tags: e.tags ?? [],
          })),
          semantic: (pack.semantic ?? []).map(memoryEntryToProto),
          signature: pack.signature ?? '',
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ImportMemory: async (call: any, callback: any) => {
      try {
        const p = call.request.pack;
        const result = await engine.import({
          version: p.version,
          projectHash: p.project_hash,
          exportedAt: p.exported_at,
          working: {
            currentGoal: p.working?.current_goal,
            activeFiles: p.working?.active_files ?? [],
            recentErrors: p.working?.recent_errors ?? [],
            discoveredPatterns: p.working?.discovered_patterns ?? [],
          },
          episodic: (p.episodic ?? []).map((e: any) => ({
            id: e.id, timestamp: e.timestamp, summary: e.summary,
            outcome: e.outcome, durationMs: e.duration_ms,
            errorCount: e.error_count, tags: e.tags,
          })),
          semantic: (p.semantic ?? []).map((e: any) => ({
            id: e.id, timestamp: e.timestamp, type: e.type,
            content: e.content, tags: e.tags, score: e.score,
          })),
          signature: p.signature,
        } as any);
        callback(null, result);
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    Snapshot: async (call: any, callback: any) => {
      try {
        const snapshot = await engine.snapshot(call.request.branch_name) as any;
        const pack = snapshot.pack;
        callback(null, {
          branch_name: snapshot.branchName,
          created_at: snapshot.createdAt,
          pack: {
            version: pack.version ?? '1.0',
            project_hash: pack.projectHash ?? '',
            exported_at: pack.exportedAt ?? Date.now(),
            working: {
              current_goal: pack.working?.currentGoal ?? '',
              active_files: pack.working?.activeFiles ?? [],
              recent_errors: pack.working?.recentErrors ?? [],
              discovered_patterns: pack.working?.discoveredPatterns ?? [],
            },
            episodic: (pack.episodic ?? []).map((e: any) => ({
              id: e.id, timestamp: e.timestamp, summary: e.summary,
              outcome: e.outcome, duration_ms: e.durationMs ?? 0,
              error_count: e.errorCount ?? 0, tags: e.tags ?? [],
            })),
            semantic: (pack.semantic ?? []).map(memoryEntryToProto),
            signature: pack.signature ?? '',
          },
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    // ── Intelligence Operations ──
    CheckContradiction: (call: any, callback: any) => {
      try {
        const { text, auto_store } = call.request;
        const result = engine.checkContradiction(text, auto_store !== false) as any;
        callback(null, {
          has_contradiction: result.hasContradiction ?? false,
          contradicting_entry: result.contradictingEntry ? memoryEntryToProto(result.contradictingEntry) : null,
          similarity: result.similarity ?? 0,
          explanation: result.explanation ?? '',
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    AnalyzeBurnout: (_call: any, callback: any) => {
      try {
        const result = engine.analyzeBurnout() as any;
        callback(null, {
          risk_level: result.riskLevel ?? 'low',
          indicators: result.indicators ?? [],
          suggestion: result.suggestion ?? '',
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    CheckBugPattern: (call: any, callback: any) => {
      try {
        const result = engine.checkBugPattern(call.request.context) as any;
        callback(null, {
          has_bug_pattern: result.hasBugPattern ?? false,
          matched_pattern: result.matchedPattern ? memoryEntryToProto(result.matchedPattern) : null,
          confidence: result.confidence ?? 0,
          warning: result.warning ?? '',
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    CheckTechDebt: (call: any, callback: any) => {
      try {
        const { pattern, project_id } = call.request;
        const result = engine.checkTechDebt(pattern, project_id) as any;
        callback(null, {
          has_debt: result.hasDebt ?? false,
          matched_incident: result.matchedIncident ? memoryEntryToProto(result.matchedIncident) : null,
          severity: result.severity ?? 'low',
          warning: result.warning ?? '',
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    DetectArchitectureDrift: (call: any, callback: any) => {
      try {
        const { current_patterns, project_id } = call.request;
        const result = engine.detectArchitectureDrift(current_patterns, project_id) as any;
        callback(null, {
          has_drift: result.hasDrift ?? false,
          drifted_areas: result.driftedAreas ?? [],
          explanation: result.explanation ?? '',
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    LearnPattern: (call: any, callback: any) => {
      try {
        const { observation, tags } = call.request;
        engine.learnPattern(observation, tags);
        callback(null, { status: 'ok', kind: 'pattern' });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    // ── Forge Layer Operations ──
    VerifyEngramChain: (_call: any, callback: any) => {
      try {
        const result = engine.verifyEngramChain() as any;
        callback(null, {
          valid: result.valid ?? false,
          broken_at: result.brokenAt ?? -1,
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    RunConsolidation: (call: any, callback: any) => {
      try {
        const result = engine.runConsolidation(call.request) as any;
        callback(null, {
          entries_consolidated: result?.entriesConsolidated ?? result?.consolidated ?? 0,
          dry_run: call.request.dry_run ?? false,
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    RunPruneSweep: (_call: any, callback: any) => {
      try {
        const result = engine.runPruneSweep() as any;
        callback(null, { entries_pruned: result?.deleted ?? 0 });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    GetProvenance: (call: any, callback: any) => {
      try {
        const result = engine.explainProvenance(call.request.id) as any;
        callback(null, {
          id: result?.id ?? call.request.id,
          source_kind: result?.sourceKind ?? 'unknown',
          source_detail: result?.sourceDetail ?? '',
          actor_id: result?.actorId ?? '',
          observed_at: result?.observedAt ?? 0,
          valid_from: result?.validFrom ?? 0,
          valid_until: result?.validUntil ?? 0,
          evidence_count: result?.evidenceCount ?? 0,
          confidence: result?.confidence ?? 0,
          json_payload: JSON.stringify(result ?? {}),
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    GuardCheck: (call: any, callback: any) => {
      try {
        const result = engine.guardCheck(call.request.content) as any;
        callback(null, {
          allowed: result?.allowed ?? true,
          reason: result?.reason ?? '',
          json_payload: JSON.stringify(result ?? {}),
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    RunAudit: (_call: any, callback: any) => {
      try {
        const result = engine.runAudit() as any;
        callback(null, { json_payload: JSON.stringify(result ?? {}) });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    RevealBias: (_call: any, callback: any) => {
      try {
        const result = engine.revealBias() as any;
        callback(null, { json_payload: JSON.stringify(result ?? {}) });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    // ── Conflict Resolution ──
    ResolveConflict: (call: any, callback: any) => {
      try {
        const { conflict_id, action, merged_content, resolved_by } = call.request;
        if (!conflict_id) {
          return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'conflict_id required' });
        }
        const conflict = pendingConflicts.get(conflict_id);
        if (!conflict) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'Conflict not found' });
        }
        switch (action) {
          case 'keep_a':
            break;
          case 'keep_b':
            engine.store({ content: conflict.entryB.content, type: conflict.entryB.type ?? 'fact', tags: conflict.entryB.tags ?? [] });
            break;
          case 'merge':
          case 'overwrite':
            if (!merged_content) {
              return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'merged_content required for merge/overwrite' });
            }
            engine.store({ content: merged_content, type: conflict.entryB.type ?? 'fact', tags: [...new Set([...(conflict.entryA.tags ?? []), ...(conflict.entryB.tags ?? [])])] });
            break;
          default:
            return callback({ code: grpc.status.INVALID_ARGUMENT, message: `Unknown action: ${action}` });
        }
        conflict.status = 'user_resolved';
        pendingConflicts.delete(conflict_id);
        callback(null, { status: 'ok', conflict_id, resolution: action });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    CancelConflict: (call: any, callback: any) => {
      try {
        const { conflict_id } = call.request;
        if (!conflict_id) {
          return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'conflict_id required' });
        }
        const conflict = pendingConflicts.get(conflict_id);
        if (!conflict) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'Conflict not found' });
        }
        pendingConflicts.delete(conflict_id);
        callback(null, { status: 'ok', message: 'Conflict dismissed' });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ListConflicts: (_call: any, callback: any) => {
      callback(null, {
        conflicts: Array.from(pendingConflicts.values()).map(c => ({
          conflict_id: c.conflictId,
          project_id: c.projectId,
          agent_a_id: c.agentAId,
          agent_b_id: c.agentBId,
          similarity: c.similarity,
          detected_at: c.detectedAt,
          status: c.status,
          suggested_resolution: c.suggestedResolution ?? '',
        })),
      });
    },

    // ── Health ──
    Health: (_call: any, callback: any) => {
      callback(null, {
        status: 'ok',
        timestamp: Date.now(),
        engine: 'MemoryEngine',
        version: '1.0.0',
      });
    },

    // ── Server Streaming ──
    StreamContext: (call: any) => {
      const { project_id, user_id, layers, min_confidence } = call.request;

      const insightTypes = ['insight', 'contradiction', 'drift', 'pattern', 'decay', 'event'];
      let idx = 0;

      const timer = setInterval(async () => {
        try {
          if (call.cancelled) {
            clearInterval(timer);
            return;
          }

          // Check for active contradictions related to project
          if (project_id && idx % 5 === 0) {
            const recentContext = await engine.getContextString(project_id);
            if (recentContext) {
              call.write({
                type: 'insight',
                layer: 'semantic',
                title: 'Context Update',
                description: recentContext.substring(0, 500),
                confidence: 0.8,
                timestamp: Date.now(),
                metadata: { project_id, user_id: user_id ?? '' },
              });
            }
          }

          // Push intelligence insights periodically (every ~30s simulated)
          if (idx === 5) {
            try {
              const burnout = engine.analyzeBurnout() as any;
              if (burnout && burnout.riskLevel && burnout.riskLevel !== 'low') {
                call.write({
                  type: 'insight',
                  layer: 'semantic',
                  title: `Burnout Risk: ${burnout.riskLevel}`,
                  description: burnout.suggestion ?? '',
                  confidence: 0.7,
                  timestamp: Date.now(),
                  metadata: { project_id: project_id ?? '', risk_level: burnout.riskLevel },
                });
              }
            } catch { /* skip burnout if not available */ }
          }

          if (idx === 10) {
            try {
              const audit = engine.runAudit() as any;
              if (audit && audit.healthScore !== undefined && audit.healthScore < 0.5) {
                call.write({
                  type: 'insight',
                  layer: 'audit',
                  title: 'Memory Health Alert',
                  description: `Memory health score is ${Math.round((audit.healthScore ?? 0) * 100)}%. Consider consolidation.`,
                  confidence: 0.9,
                  timestamp: Date.now(),
                  metadata: { project_id: project_id ?? '', health_score: String(audit.healthScore ?? 0) },
                });
              }
            } catch { /* skip audit if not available */ }
          }

          idx++;
          if (idx > 50) clearInterval(timer);
        } catch { /* ignore streaming errors */ }
      }, 6000);

      call.on('cancelled', () => {
        clearInterval(timer);
      });
    },

    // ── Client Streaming ──
    IngestEpisodes: (call: any, callback: any) => {
      let accepted = 0;
      let deduplicated = 0;
      let errors = 0;

      call.on('data', (req: any) => {
        try {
          const episodes = req.episodes ?? [];
          for (const ep of episodes) {
            const existing = engine.loadEpisodes(100) as any[];
            const isDup = existing.some(
              (e: any) => e.summary === ep.summary && Math.abs(e.timestamp - (ep.timestamp ?? 0)) < 60000
            );
            if (isDup) {
              deduplicated++;
            } else {
              engine.storeEpisode(fromProtoEpisodic(ep));
              accepted++;
            }
          }
        } catch {
          errors++;
        }
      });

      call.on('end', () => {
        callback(null, { accepted, deduplicated, errors });
      });
    },

    // ── Bidirectional Streaming ──
    AgentStream: (call: any) => {
      const agents = new Map<string, { agentId: string; sessionId: string; lastSeen: number }>();
      let projectId: string | null = null;

      call.on('data', (event: any) => {
        try {
          if (call.cancelled) return;

          const { agent_id, session_id, event_type, payload, timestamp, project_id } = event;

          if (project_id) projectId = project_id;

          agents.set(agent_id ?? 'unknown', {
            agentId: agent_id ?? 'unknown',
            sessionId: session_id ?? '',
            lastSeen: timestamp ?? Date.now(),
          });

          // Check for pending conflicts for this agent and push them
          if (event_type === 'check_conflicts' || event_type === 'stored_memory') {
            const agentConflicts = Array.from(pendingConflicts.values())
              .filter(c => c.status === 'pending' && (c.agentAId === agent_id || c.agentBId === agent_id));
            for (const conflict of agentConflicts) {
              call.write({
                agent_event: null,
                memory_insight: {
                  type: 'conflict_detected',
                  layer: 'semantic',
                  title: 'Write Conflict Detected',
                  description: conflict.suggestedResolution ?? '',
                  confidence: conflict.similarity,
                  timestamp: Date.now(),
                  metadata: {
                    conflict_id: conflict.conflictId,
                    project_id: conflict.projectId,
                    agent_a_id: conflict.agentAId,
                    agent_b_id: conflict.agentBId,
                    status: conflict.status,
                  },
                },
                error: null,
              });
            }
          }

          // Store the event as an episode
          if (event_type && event_type !== 'heartbeat' && event_type !== 'check_conflicts') {
            engine.storeEpisode({
              summary: `[${event_type}] ${payload ? payload.substring(0, 200) : ''}`,
              outcome: event_type === 'error' ? 'failure' : 'success',
              timestamp: timestamp ?? Date.now(),
              tags: ['agent-stream', event_type, agent_id ?? ''],
            });
          }

          // Check contradiction in payload if available
          if (payload && event_type === 'stored_memory') {
            try {
              const parsed = JSON.parse(payload);
              if (parsed.content) {
                const contradiction = engine.checkContradiction(parsed.content, false) as any;
                if (contradiction?.hasContradiction) {
                  call.write({
                    agent_event: null,
                    memory_insight: {
                      type: 'contradiction',
                      layer: 'semantic',
                      title: 'Contradiction Detected',
                      description: contradiction.explanation ?? 'New memory contradicts existing knowledge',
                      confidence: contradiction.similarity ?? 0.8,
                      timestamp: Date.now(),
                      metadata: { agent_id: agent_id ?? '', event_type },
                    },
                    error: null,
                  });
                }
              }
            } catch { /* skip contradiction check on parse failure */ }
          }

          // Send heartbeat acknowledgment
          if (event_type === 'heartbeat') {
            call.write({
              agent_event: null,
              memory_insight: {
                type: 'event',
                layer: 'system',
                title: 'Heartbeat ACK',
                description: `Connection active for agent ${agent_id ?? 'unknown'}`,
                confidence: 1.0,
                timestamp: Date.now(),
                metadata: { agent_id: agent_id ?? '' },
              },
              error: null,
            });
          }
        } catch {
          call.write({
            agent_event: null,
            memory_insight: null,
            error: { code: 'PROCESSING_ERROR', message: 'Failed to process agent event' },
          });
        }
      });

      call.on('end', () => {
        call.end();
      });

      call.on('cancelled', () => {
        agents.clear();
        projectId = null;
      });
    },
  };

  server.addService(proto.timps.memory.v1.MemoryService.service, serviceImpl);

  return server;
}

export function startGrpcServer(engine: MemoryEngine, options: GrpcServerOptions = {}): Promise<{ server: grpc.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createGrpcServer(engine, options);
    const port = options.port ?? 4101;
    const host = options.host ?? '0.0.0.0';
    const credentials = options.credentials ?? grpc.ServerCredentials.createInsecure();

    server.bindAsync(`${host}:${port}`, credentials, (err, boundPort) => {
      if (err) {
        reject(err);
        return;
      }
      server.start();
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     TIMPS gRPC MemoryServer                               ║
║     Language-agnostic binary protocol                     ║
║                                                           ║
║     gRPC:  ${host}:${String(boundPort).padEnd(40)}║
║     Proto: ${path.relative(process.cwd(), PROTO_PATH).padEnd(50)}║
║                                                           ║
║     Streaming modes:                                       ║
║     - Server stream (StreamContext)                        ║
║     - Client stream (IngestEpisodes)                       ║
║     - Bidirectional (AgentStream)                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
      resolve({ server, port: boundPort });
    });
  });
}

export function protoPath(): string {
  return PROTO_PATH;
}
