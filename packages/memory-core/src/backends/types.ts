// ── @timps/memory-core — StorageBackend Interface ──
// All forge layers talk to storage through this interface.
// FileBackend, PostgresBackend, SQLiteBackend, RedisBackend, InMemoryBackend all implement it.

export interface StorageBackend {
  /** Read a value by key. Returns parsed object or null if not found. */
  read(key: string): Promise<any> | any;

  /** Store a value. Creates or overwrites. Returns void. */
  write(key: string, value: any): Promise<void> | void;

  /** Remove a key. No error if missing. */
  delete(key: string): Promise<void> | void;

  /** List all keys, optionally filtered by prefix. */
  list(prefix?: string): Promise<string[]> | string[];

  /**
   * Advanced retrieval — find memories matching criteria.
   * Default implementation uses list + in-memory filter.
   */
  query?(filter: StorageQuery): Promise<StorageRecord[]> | StorageRecord[];

  /** Begin a transaction for atomic multi-write operations. */
  beginTxn?(): Promise<StorageTransaction> | StorageTransaction;

  /** Check if a key exists. */
  exists?(key: string): Promise<boolean> | boolean;

  /** Append a string line to a log-style key (JSONL). */
  append(key: string, line: string): Promise<void> | void;
}

export interface StorageQuery {
  prefix?: string;
  /** Timestamp range filter (entry.timestamp) */
  timestampMin?: number;
  timestampMax?: number;
  /** Custom predicate evaluated on parsed values */
  filter?: (value: any) => boolean;
  limit?: number;
}

export interface StorageRecord {
  key: string;
  value: any;
}

export interface StorageTransaction {
  write(key: string, value: any): void;
  delete(key: string): void;
  commit(): Promise<void> | void;
  rollback(): Promise<void> | void;
}

// ── Default key prefixes for forge layers ──
// Each forge gets a namespace prefix to avoid collisions.
export const KEY_PREFIXES = {
  chronos: 'chronos/',
  echo: 'echo/',
  resonance: 'resonance/',
  harmonic: 'harmonic/',
  aether: 'aether/',
  eclipse: 'eclipse/',
  qptw: 'qptw/',
  titanic: 'titanic/',
  qerw: 'qerw/',
  qisrd: 'qisrd/',
  qitrl: 'qitrl/',
  causalSheaf: 'causal_sheaf/',
  working: 'working/',
  semantic: 'semantic/',
  episodic: 'episodic/',
  engram: 'engram/',
  consolidation: 'consolidation/',
  synaptic: 'synaptic/',
  provenance: 'provenance/',
  spacedRep: 'spaced_rep/',
  constitutional: 'constitutional/',
  audit: 'audit/',
  prospective: 'prospective/',
  bias: 'bias/',
  context: 'context/',
  rehearsal: 'rehearsal/',
  schema: 'schema/',
  confidence: 'confidence/',
  contradiction: 'contradiction/',
  burnout: 'burnout/',
  regret: 'regret/',
  techDebt: 'tech_debt/',
  bugPattern: 'bug_pattern/',
  api: 'api/',
  velocity: 'velocity/',
  architecture: 'architecture/',
  pattern: 'pattern/',
  meeting: 'meeting/',
  deadReckoning: 'dead_reckoning/',
  manifesto: 'manifesto/',
  relationship: 'relationship/',
  skill: 'skill/',
  curriculum: 'curriculum/',
  anthropologist: 'anthropologist/',
  institutional: 'institutional/',
  falseMemory: 'false_memory/',
  calibrator: 'calibrator/',
  attributor: 'attributor/',
  conflict: 'conflict/',
  auditor: 'auditor/',
  schemaInferrer: 'schema_inferrer/',
  biasRevealer: 'bias_revealer/',
  prospectiveTrigger: 'prospective_trigger/',
} as const;
