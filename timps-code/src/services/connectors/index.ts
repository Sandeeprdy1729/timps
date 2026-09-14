// ── TIMPS Connectors — exports ──

export { CONNECTORS, connectorDef } from './registry.js';
export type { ConnectorDef } from './registry.js';
export {
  providerDir,
  tokensFile,
  clientFile,
  stateFile,
  summariesFile,
  rawDir,
  enstateDir,
  loadTokens,
  saveTokens,
  loadClient,
  loadState,
  saveState,
  syncedCount,
  ensureAccessToken,
  disconnectConnector,
} from './tokens.js';
export type { ConnectorTokens, ConnectorState, ConnectorClient } from './tokens.js';
export { fetchRecentItems, runConnectorSync } from './sync.js';
export type { ConnectorSyncOptions, ConnectorSyncResult } from './sync.js';
export type { ConnectorItem } from './clients.js';