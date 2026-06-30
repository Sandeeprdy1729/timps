# @timps-ai/memory-core

Persistent memory engine for AI agents — working, episodic, semantic, procedural memory with 17 intelligence tools, contradiction detection, bug pattern tracking, and burnout monitoring.

```bash
npm install @timps-ai/memory-core
```

## Quickstart

```typescript
import { MemoryEngine, InMemoryBackend } from '@timps-ai/memory-core'

const engine = new MemoryEngine('./my-project', {
  backend: new InMemoryBackend()
})

// Store a memory
engine.store({ content: 'The API uses JWT authentication', type: 'fact', tags: ['auth', 'security'] })

// Recall memories
const results = await engine.recall('how does authentication work')
console.log(results)
```

## Architecture

22-layer memory architecture with 4 core memory types + 18 forge layers:

| Layer | Name | Purpose |
|-------|------|---------|
| L1 | Working Memory | Active context, goals, current task tracking |
| L2 | Episodic Memory | Session history, interaction records |
| L3 | Semantic Memory | Facts, preferences, conventions, patterns |
| L4 | Procedural Memory | Reusable workflows, recipes |
| L5 | ChronosForge | Causal graph tracking decisions and consequences |
| L6 | ResonanceForge | Harmonic oscillator pattern resonance detection |
| L7 | EchoForge | Reservoir computing with BFS context propagation |
| L8 | AetherForgeERL | Epistemic Resonance Lattice |
| L9 | HarmonicSheafWeaver | Sheaf-cohomology algebraic contradiction detection |
| L10 | EngramLog | Immutable hash-chained audit trail |
| L11 | ConsolidationEngine | Episodic → semantic memory promotion |
| L12 | SynapticPruner | Active forgetting by importance scoring |
| L13 | ProvenanceForge | Source tracking and chain of custody |
| L14 | SpacedRepetitionForge | SM-2 scheduling for review timing |
| L15 | ConstitutionalGuard | Prevents low-confidence writes |
| L16 | AuditForge | Memory health reports and drift detection |
| L17 | ProspectiveTrigger | Conditional recall ("when X happens, surface Y") |
| L18 | BiasRevealer | Over/under-representation analysis |
| L19 | ContextVector | State-dependent recall encoding |
| L20 | RehearsalEngine | Spaced retrieval practice scheduling |
| L21 | SchemaDistorter | Bartlett schema-driven distortion detection |
| L22 | ConfidenceCalibrator | Multi-signal confidence scoring |

Additional forge subsystems (SupraSheaf, QPTW, TitanicForge, QERW, QISRD, EclipseForge, QITRL) are available for advanced use cases.

## Intelligence Tools (25 total)

- ContradictionDetector — detect conflicting stored facts
- BurnoutSeismograph — monitor developer fatigue signals
- RegretOracle — identify past decisions that caused issues
- TechDebtSeismograph — forecast maintenance burden
- BugPatternProphet — predict bug-prone patterns
- APIArchaeologist — track API quirks and gotchas
- VelocityTracker — monitor workflow velocity and patterns
- ArchitectureDriftDetector — track design divergence
- PatternLearner — extract reusable knowledge
- MeetingGhost — extract commitments from conversations
- DeadReckoning — simulate past decisions before repeating them
- LivingManifesto — derive values from behavioral patterns
- RelationshipIntelligence — track relationship health
- SkillShadow — identify tacit skills and gaps
- CurriculumArchitect — build personalized learning paths
- CodebaseAnthropologist — analyze codebase culture and norms
- InstitutionalMemory — capture departed contributor knowledge
- FalseMemoryDetector — detect hallucinated or incorrect memories
- ConfidenceCalibratorTool — score memory reliability
- SourceAttributor — trace memory origins
- ConflictResolver — resolve conflicting entries
- MemoryAuditor — full memory system audit
- ProspectiveTriggerTool — set conditional recall triggers
- BiasRevealerTool — surface systematic biases
- SchemaInferrer — derive structure from data

## Storage Backends

| Backend | File | Description |
|---------|------|-------------|
| `FileBackend` | `backends/FileBackend.ts` | Local filesystem (default) |
| `InMemoryBackend` | `backends/InMemoryBackend.ts` | In-memory (testing) |
| `PostgresBackend` | `backends/PostgresBackend.ts` | PostgreSQL with RLS |
| `SQLiteBackend` | `backends/SQLiteBackend.ts` | SQLite (WAL mode) |
| `RedisBackend` | `backends/RedisBackend.ts` | Redis key/value |
| `QdrantBackend` | `backends/QdrantBackend.ts` | Vector search |

## Note on Intelligence Tool Results

New engines with no accumulated data will return empty/undefined fields from tools like burnout analysis, bug pattern prophecy, and architecture drift detection. These tools require multiple sessions of stored episodes and patterns before producing meaningful output.
