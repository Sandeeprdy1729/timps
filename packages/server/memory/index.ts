export { ShortTermMemoryStore, ShortTermMemory } from './shortTerm';
export { LongTermMemoryStore, Memory, Goal, Preference, Project } from './longTerm';
export { EmbeddingService } from './embedding';
export { MemoryIndex, memoryIndex, UserMemory } from './memoryIndex';
export {
  ChronosForge,
  chronosForge,
  ChronosNode,
  CausalEdge,
  ForesightResult,
  WeaveResult,
  TemporalQueryResult,
  SignalDomain,
} from './chronosForge.js';
export {
  ResonanceForge,
  resonanceForge,
} from './resonanceForge.js';
export type {
  ResonanceDomain,
  ResonanceNode,
  ResonanceCausalEdge,
  HarmonicPattern,
  ResonanceWeaveResult,
  ResonancePrediction,
  ResonanceQueryResult,
  ResonanceTemporalQueryResult,
  HarmonicConsolidationReport,
} from './resonanceForge.js';

// Layer 7: EchoForge — causal echo propagation + reservoir computing
export { ServerEchoForge, echoForge, getServerEchoForge } from './echoForge.js';
export type { EchoDomain, EchoPrediction, EchoStatus, EchoWeaveResult, EchoQueryResult } from './echoForge.js';

// Layer 9: HarmonicSheafWeaver — sheaf-cohomology H¹ contradiction detection + eigenmode foresight
export { ServerHarmonicSheafWeaver, sheafWeaver, getServerSheafWeaver } from './harmonicSheafWeaver.js';
export type {
  SheafDomain,
  SheafPrediction,
  SheafStatus,
  SheafWeaveResult,
  SheafQueryResult,
  CohomologyResult,
  SheafConsolidationReport,
} from './harmonicSheafWeaver.js';

// Layer 10: AetherForgeERL — epistemic resonance lattice + FlowForge
export { ServerAetherForgeERL, aetherForge, getServerAetherForgeERL } from './aetherForgeERL.js';
export type {
  ERLDomain,
  ERLPrediction,
  ERLStatus,
  ERLWeaveResult,
  ERLQueryResult,
  ERLCohomologyResult,
  ERLConsolidationReport,
  FlowForgePrediction,
  FlowForgeAutoConsolidationReport,
} from './aetherForgeERL.js';

// Layer 11: SupraSheaf — cross-layer sheaf coordinator
export { getSupraSheaf } from './supraSheaf.js';
export type {
  SupraCollectNodesResult,
  SupraCrossLayerH1Result,
  SupraJointForesightResult,
  SupraConsistencyResult,
} from './supraSheaf.js';

// Layer 12: QPTW — Quantum-Phase Temporal Weaver
export { getServerQPTW } from './qptw.js';
export type {
  QPTWDomain, QPTWWeaveResult, QPTWContradictionResult,
  QPTWPrediction, QPTWQueryResult, QPTWConsolidationReport,
} from '@timps/memory-core';

// Layer 13: TitanicForge — Neural Surprise-Augmented Sheaf Weaver
export { getServerTitanicForge } from './titanicForge.js';
export type {
  TitanicDomain, TitanicWeaveResult, TitanicSurpriseResult,
  TitanicQueryResult, TitanicConsolidationReport,
} from '@timps/memory-core';

// Layer 14: QERW — QuantumEcho Resonance Weaver
export { getServerQERW } from './qerw.js';
export type {
  QERWDomain, QERWWeaveResult, QERWContradictionResult,
  QERWPrediction, QERWQueryResult, QERWConsolidationReport,
} from '@timps/memory-core';

// Layer 15: QISRD — Quantum-Inspired Sheaf Resonance Dynamics
export { getServerQISRD } from './qisrd.js';
export type {
  QISRDDomain, QISRDWeaveResult, QISRDContradictionResult,
  QISRDPrediction, QISRDQueryResult, QISRDConsolidationReport,
} from '@timps/memory-core';

// Layer 17: EclipseForge — Temporal Sheaf Resonator
export { getServerEclipseForge } from './eclipseForge.js';
export type {
  EclipseDomain, EclipseWeaveResult, EclipseCohomologyResult,
  EclipsePrediction, EclipseQueryResult, EclipseConsolidationReport,
} from '@timps/memory-core';

// Layer 18: QITRL — Quantum-Inspired Temporal Resonance Lattice
export { getServerQITRL } from './qitrl.js';
export type {
  QITRLDomain, QITRLWeaveResult, QITRLCohomologyResult,
  QITRLPrediction, QITRLQueryResult, QITRLConsolidationReport,
} from '@timps/memory-core';
