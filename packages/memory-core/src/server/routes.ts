import { Router } from 'express';
import type { Response } from 'express';
import type { MemoryEngine } from '../MemoryEngine';
import type { AuthenticatedRequest } from './auth';
import type { MemoryWsServer, WsEvent } from './websocket';
import type { MemoryEntry, ConflictEvent, ConflictResolutionRequest, ConflictResolutionAction } from '../types.js';
import { generateId } from '../storage.js';

const pendingConflicts = new Map<string, ConflictEvent>();

export function createMemoryRoutes(engine: MemoryEngine, wsServer?: MemoryWsServer): Router {
  const router = Router();

  function emit(event: WsEvent): void {
    if (wsServer) wsServer.broadcast(event);
  }

  // ── Store a memory event ────────────────────────────────────────────────
  router.post('/store', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { content, type, tags, episode, projectId } = req.body;
      const userId = req.auth?.userId ?? 'anonymous';

      if (episode) {
        engine.storeEpisode({
          summary: episode.summary ?? '',
          outcome: episode.outcome ?? 'unknown',
          timestamp: episode.timestamp ?? Date.now(),
          durationMs: episode.durationMs,
          errorCount: episode.errorCount,
          tags: episode.tags,
        });
        emit({ type: 'memory_stored', userId, payload: { kind: 'episode', summary: episode.summary } });
        return res.json({ status: 'ok', kind: 'episode' });
      }

      if (!content) {
        return res.status(400).json({ error: 'content is required (or provide episode object)' });
      }

      // Phase 2d: Synchronous conflict detection at write time
      const entries = engine.getSemanticEntries();
      const conflictResult = (engine as any).contradiction?.checkBeforeStore(
        { content, type: type ?? 'fact', tags: tags ?? [] } as MemoryEntry,
        entries,
      );

      if (conflictResult?.hasConflict) {
        const conflictId = generateId('conflict');
        const conflict: ConflictEvent = {
          conflictId,
          projectId: projectId ?? 'default',
          agentAId: conflictResult.conflictingEntry?.actorId ?? 'unknown',
          agentBId: userId,
          entryA: conflictResult.conflictingEntry!,
          entryB: { content, type: type ?? 'fact', tags: tags ?? [] } as MemoryEntry,
          similarity: conflictResult.similarity,
          detectedAt: Date.now(),
          suggestedResolution: conflictResult.explanation,
          status: 'pending',
        };
        pendingConflicts.set(conflictId, conflict);

        emit({
          type: 'contradiction',
          userId,
          payload: { ...conflict } as unknown as Record<string, unknown>,
        });

        return res.status(409).json({
          status: 'conflict',
          conflict,
          message: 'Memory conflicts with existing entry. Resolve before storing.',
        });
      }

      engine.store({ content, type: type ?? 'fact', tags: tags ?? [] });
      emit({ type: 'memory_stored', userId, payload: { kind: 'semantic', content, type } });
      res.json({ status: 'ok', kind: 'semantic' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Recall memories matching a query ────────────────────────────────────
  router.post('/recall', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { query, limit, type, tags, minConfidence, maxFalseMemoryRisk } = req.body;
      const userId = req.auth?.userId ?? 'anonymous';

      if (!query && query !== '') {
        return res.status(400).json({ error: 'query is required' });
      }

      const results = engine.recall(query, {
        limit: limit ?? 10,
        type,
        tags,
        minConfidence,
        maxFalseMemoryRisk,
        useIntelligence: true,
      });

      emit({ type: 'memory_recalled', userId, payload: { query, count: results.length } });
      res.json({ results, count: results.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get memory statistics ───────────────────────────────────────────────
  router.get('/stats', (_req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = engine.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Delete a memory by id or content match ──────────────────────────────
  router.delete('/delete', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, content } = req.body;

      if (!id && !content) {
        return res.status(400).json({ error: 'id or content is required' });
      }

      if (id) {
        // Delete from semantic store by id
        const entries = engine.getSemanticEntries();
        const filtered = entries.filter((e: any) => e.id !== id);
        if (filtered.length < entries.length) {
          engine.saveSemanticEntries(filtered);
          return res.json({ status: 'ok', deleted: 1 });
        }
        return res.status(404).json({ error: 'Memory not found' });
      }

      if (content) {
        const entries = engine.getSemanticEntries();
        const filtered = entries.filter((e: any) => !e.content.includes(content));
        const deleted = entries.length - filtered.length;
        if (deleted > 0) {
          engine.saveSemanticEntries(filtered);
          return res.json({ status: 'ok', deleted });
        }
        return res.status(404).json({ error: 'No matching memories found' });
      }

      res.json({ status: 'ok', deleted: 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Query with extended options ─────────────────────────────────────────
  router.post('/query', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { query, options } = req.body;
      const userId = req.auth?.userId ?? 'anonymous';

      if (!query && query !== '') {
        return res.status(400).json({ error: 'query is required' });
      }

      const results = engine.recall(query, {
        limit: options?.limit ?? 10,
        type: options?.type,
        tags: options?.tags,
        minConfidence: options?.minConfidence,
        maxFalseMemoryRisk: options?.maxFalseMemoryRisk,
        useIntelligence: options?.useIntelligence ?? true,
        context: options?.context,
      });

      res.json({ results, count: results.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get working memory state ────────────────────────────────────────────
  router.get('/working', (_req: AuthenticatedRequest, res: Response) => {
    try {
      res.json(engine.workingMemory);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Set goal in working memory ──────────────────────────────────────────
  router.post('/working/goal', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { goal } = req.body;
      if (!goal) return res.status(400).json({ error: 'goal is required' });
      engine.setGoal(goal);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Track active file ────────────────────────────────────────────────────
  router.post('/working/file', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { filePath } = req.body;
      if (!filePath) return res.status(400).json({ error: 'filePath is required' });
      engine.trackFile(filePath);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Track error ─────────────────────────────────────────────────────────
  router.post('/working/error', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { error } = req.body;
      if (!error) return res.status(400).json({ error: 'error is required' });
      engine.trackError(error);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Clear working memory ────────────────────────────────────────────────
  router.post('/working/clear', (_req: AuthenticatedRequest, res: Response) => {
    try {
      engine.clearWorking();
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get context string (for prompt injection) ───────────────────────────
  router.post('/context', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { task } = req.body;
      const context = engine.getContextString(task ?? '');
      res.json({ context });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Store an episode ────────────────────────────────────────────────────
  router.post('/episode', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { summary, outcome, durationMs, errorCount, tags } = req.body;
      if (!summary) return res.status(400).json({ error: 'summary is required' });
      engine.storeEpisode({
        summary,
        outcome: outcome ?? 'unknown',
        timestamp: Date.now(),
        durationMs,
        errorCount,
        tags,
      });
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Load episodes ───────────────────────────────────────────────────────
  router.get('/episodes', (req: AuthenticatedRequest, res: Response) => {
    try {
      const count = parseInt(req.query.count as string, 10) || 10;
      const episodes = engine.loadEpisodes(count);
      res.json({ episodes, count: episodes.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Extract facts from conversation ─────────────────────────────────────
  router.post('/extract-facts', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userMessage, assistantResponse } = req.body;
      if (!userMessage || !assistantResponse) {
        return res.status(400).json({ error: 'userMessage and assistantResponse are required' });
      }
      engine.extractFacts(userMessage, assistantResponse);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Consolidate (deduplicate) ───────────────────────────────────────────
  router.post('/consolidate', (_req: AuthenticatedRequest, res: Response) => {
    try {
      const removed = engine.consolidate();
      res.json({ status: 'ok', duplicatesRemoved: removed });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Export all memory ───────────────────────────────────────────────────
  router.get('/export', async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const pack = await engine.export();
      res.json(pack);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Import memory pack ──────────────────────────────────────────────────
  router.post('/import', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await engine.import(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Snapshot memory ─────────────────────────────────────────────────────
  router.post('/snapshot', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { branchName } = req.body;
      if (!branchName) return res.status(400).json({ error: 'branchName is required' });
      const snapshot = await engine.snapshot(branchName);
      res.json(snapshot);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Intelligence API ────────────────────────────────────────────────────

  // Contradiction check
  router.post('/intelligence/contradiction', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { text, autoStore } = req.body;
      if (!text) return res.status(400).json({ error: 'text is required' });
      const result = engine.checkContradiction(text, autoStore !== false);
      emit({ type: 'contradiction', userId: req.auth?.userId ?? 'anonymous', payload: result as unknown as Record<string, unknown> });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Burnout analysis
  router.get('/intelligence/burnout', (_req: AuthenticatedRequest, res: Response) => {
    try {
      const result = engine.analyzeBurnout();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bug pattern check
  router.post('/intelligence/bug-pattern', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { context } = req.body;
      if (!context) return res.status(400).json({ error: 'context is required' });
      const result = engine.checkBugPattern(context);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Tech debt check
  router.post('/intelligence/tech-debt', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { pattern, projectId } = req.body;
      if (!pattern) return res.status(400).json({ error: 'pattern is required' });
      const result = engine.checkTechDebt(pattern, projectId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Architecture drift check
  router.post('/intelligence/architecture-drift', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { currentPatterns, projectId } = req.body;
      const result = engine.detectArchitectureDrift(currentPatterns, projectId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Learn pattern
  router.post('/intelligence/learn-pattern', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { observation, tags } = req.body;
      if (!observation) return res.status(400).json({ error: 'observation is required' });
      const result = engine.learnPattern(observation, tags);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Conflict Resolution API ──────────────────────────────────────────────

  // Get all pending conflicts
  router.get('/conflicts', (_req: AuthenticatedRequest, res: Response) => {
    res.json({ conflicts: Array.from(pendingConflicts.values()) });
  });

  // Get a specific conflict
  router.get('/conflicts/:id', (req: AuthenticatedRequest, res: Response) => {
    const conflict = pendingConflicts.get(String(req.params.id));
    if (!conflict) return res.status(404).json({ error: 'Conflict not found' });
    res.json(conflict);
  });

  // Resolve a conflict
  router.post('/resolve-conflict', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { conflictId, action, mergedContent, resolvedBy }: ConflictResolutionRequest = req.body;
      if (!conflictId) return res.status(400).json({ error: 'conflictId is required' });
      if (!action) return res.status(400).json({ error: 'action is required' });

      const conflict = pendingConflicts.get(conflictId);
      if (!conflict) return res.status(404).json({ error: 'Conflict not found' });

      // Apply resolution
      switch (action) {
        case 'keep_a':
          // Keep the existing entry (entryA) — no-op for storage, just clear conflict
          break;
        case 'keep_b':
          // Store the new entry (entryB) — overwrite the existing one
          engine.store({ content: conflict.entryB.content, type: conflict.entryB.type ?? 'fact', tags: conflict.entryB.tags ?? [] });
          break;
        case 'merge':
          // Merge content from both entries
          if (!mergedContent) return res.status(400).json({ error: 'mergedContent is required for merge action' });
          engine.store({ content: mergedContent, type: conflict.entryB.type ?? 'fact', tags: [...new Set([...(conflict.entryA.tags ?? []), ...(conflict.entryB.tags ?? [])])] });
          break;
        case 'overwrite':
          // Overwrite with mergedContent
          if (!mergedContent) return res.status(400).json({ error: 'mergedContent is required for overwrite action' });
          engine.store({ content: mergedContent, type: conflict.entryB.type ?? 'fact', tags: conflict.entryB.tags ?? [] });
          break;
        default:
          return res.status(400).json({ error: `Unknown action: ${action}` });
      }

      conflict.status = 'user_resolved';
      pendingConflicts.delete(conflictId);

      emit({
        type: 'insight',
        userId: resolvedBy ?? 'anonymous',
        payload: { kind: 'conflict_resolved', conflictId, action },
      });

      res.json({ status: 'ok', conflict: { ...conflict, status: 'user_resolved' } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cancel/Dismiss a conflict (keep existing, discard new)
  router.post('/cancel-conflict', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { conflictId } = req.body;
      if (!conflictId) return res.status(400).json({ error: 'conflictId is required' });
      const conflict = pendingConflicts.get(conflictId);
      if (!conflict) return res.status(404).json({ error: 'Conflict not found' });
      pendingConflicts.delete(conflictId);
      res.json({ status: 'ok', message: 'Conflict dismissed. New entry was not stored.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Forge layer access ──────────────────────────────────────────────────

  // Engram log verify
  router.get('/forge/engram/verify', (_req: AuthenticatedRequest, res: Response) => {
    try {
      const result = engine.verifyEngramChain();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Run consolidation
  router.post('/forge/consolidate', (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = engine.runConsolidation(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Prune sweep
  router.post('/forge/prune', (_req: AuthenticatedRequest, res: Response) => {
    try {
      const result = engine.runPruneSweep();
      emit({
        type: 'decay_complete',
        userId: _req.auth?.userId ?? 'anonymous',
        payload: { entriesPruned: (result as any)?.deleted ?? 0 },
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Provenance
  router.get('/forge/provenance/:id', (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const result = engine.explainProvenance(id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Constitutional guard check
  router.post('/forge/guard', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: 'content is required' });
      const result = engine.guardCheck(content);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Audit
  router.get('/forge/audit', (_req: AuthenticatedRequest, res: Response) => {
    try {
      const result = engine.runAudit();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bias reveal
  router.get('/forge/bias', (_req: AuthenticatedRequest, res: Response) => {
    try {
      const result = engine.revealBias();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bias reveal (tool)
  router.get('/intelligence/bias', (_req: AuthenticatedRequest, res: Response) => {
    try {
      const result = engine.revealBias();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Health check ────────────────────────────────────────────────────────
  router.get('/health', (_req: AuthenticatedRequest, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      engine: 'MemoryEngine',
      version: '1.0.0',
    });
  });

  return router;
}
