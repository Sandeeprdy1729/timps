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

// Server forge wrappers — thin adapters using MemoryEngine with scope
export { echoForge, getServerEchoForge } from './echoForge.js';
export { sheafWeaver, getServerSheafWeaver } from './harmonicSheafWeaver.js';
export { aetherForge, getServerAetherForgeERL } from './aetherForgeERL.js';
export { getSupraSheaf } from './supraSheaf.js';
export { getServerQPTW } from './qptw.js';
export { getServerTitanicForge } from './titanicForge.js';
export { getServerQERW } from './qerw.js';
export { getServerQISRD } from './qisrd.js';
export { getServerEclipseForge } from './eclipseForge.js';
export { getServerQITRL } from './qitrl.js';

// Types re-exported from @timps/memory-core
export type { EchoDomain, EchoPrediction, EchoStatus, EchoWeaveResult, EchoQueryResult } from '@timps/memory-core';
export type { SheafDomain, SheafPrediction, SheafStatus, SheafWeaveResult, SheafQueryResult, CohomologyResult, SheafConsolidationReport } from '@timps/memory-core';
export type { ERLDomain, ERLPrediction, ERLStatus, ERLWeaveResult, ERLQueryResult, ERLCohomologyResult, ERLConsolidationReport, FlowForgePrediction, FlowForgeAutoConsolidationReport } from '@timps/memory-core';
export type { QPTWDomain, QPTWWeaveResult, QPTWContradictionResult, QPTWPrediction, QPTWQueryResult, QPTWConsolidationReport } from '@timps/memory-core';
export type { TitanicDomain, TitanicWeaveResult, TitanicSurpriseResult, TitanicQueryResult, TitanicConsolidationReport } from '@timps/memory-core';
export type { QERWDomain, QERWWeaveResult, QERWContradictionResult, QERWPrediction, QERWQueryResult, QERWConsolidationReport } from '@timps/memory-core';
export type { QISRDDomain, QISRDWeaveResult, QISRDContradictionResult, QISRDPrediction, QISRDQueryResult, QISRDConsolidationReport } from '@timps/memory-core';
export type { EclipseDomain, EclipseWeaveResult, EclipseCohomologyResult, EclipsePrediction, EclipseQueryResult, EclipseConsolidationReport } from '@timps/memory-core';
export type { QITRLDomain, QITRLWeaveResult, QITRLCohomologyResult, QITRLPrediction, QITRLQueryResult, QITRLConsolidationReport } from '@timps/memory-core';
