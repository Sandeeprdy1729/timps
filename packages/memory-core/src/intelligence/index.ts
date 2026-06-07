// ── @timps/memory-core — Intelligence Tools re-exports ──
export { ContradictionDetector } from './contradiction.js';
export type { Position, ContradictionRecord, ContradictionResult } from './contradiction.js';

export { BurnoutSeismograph } from './burnout.js';
export type { BurnoutSignal, BurnoutBaseline, BurnoutAnalysis } from './burnout.js';

export { RegretOracle } from './regretOracle.js';
export type { Decision, RegretCheckResult } from './regretOracle.js';

export { TechDebtSeismograph } from './techDebt.js';
export type { CodeIncident, PatternCheckResult, DebtReport } from './techDebt.js';

export { BugPatternProphet } from './bugPattern.js';
export type { BugPattern, BugWarnResult } from './bugPattern.js';

export { APIArchaeologist } from './apiArchaeologist.js';
export type { APIQuirk, APILookupResult } from './apiArchaeologist.js';

export { VelocityTracker } from './velocityTracker.js';
export type { WorkflowPattern, CoachResult } from './velocityTracker.js';

export { ArchitectureDriftDetector } from './architectureDrift.js';
export type { CodebaseInsight, InsightType, DriftCheckResult } from './architectureDrift.js';

export { PatternLearner } from './patternLearner.js';
export type { LearnedPattern } from './patternLearner.js';

// ── L7+ tools (new in M3 pass) ──
export { MeetingGhost } from './meetingGhost.js';
export type { Commitment, ExtractionResult } from './meetingGhost.js';

export { DeadReckoning } from './deadReckoning.js';
export type { PastDecision, SimulationResult } from './deadReckoning.js';

export { LivingManifesto } from './livingManifesto.js';
export type { ValueSignal, ManifestoReport } from './livingManifesto.js';

export { RelationshipIntelligence } from './relationship.js';
export type { Contact, RelationshipCheck } from './relationship.js';

export { SkillShadow } from './skillShadow.js';
export type { ShadowPattern } from './skillShadow.js';

export { CurriculumArchitect } from './curriculum.js';
export type { LearningGap, Curriculum } from './curriculum.js';

export { CodebaseAnthropologist } from './codebaseAnthropologist.js';
export type { CulturalNorm, CodebaseCulture } from './codebaseAnthropologist.js';

export { InstitutionalMemory } from './institutionalMemory.js';
export type { Contribution, DepartedContributor } from './institutionalMemory.js';
