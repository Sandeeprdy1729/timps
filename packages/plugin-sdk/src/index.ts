export { PluginRegistry } from './registry.js';
export { loadPlugin } from './loader.js';
export {
  VALID_PERMISSIONS,
  scanForPermissions,
  assertDeclaredPermissions,
  invalidPermissions,
  deriveToolRisk,
} from './permissions.js';
export type { PermissionScanResult } from './permissions.js';
export type {
  Plugin,
  PluginManifest,
  PluginContext,
  MemoryAPI,
  CommandSpec,
  CommandHandler,
  ToolSpec,
  ToolHandler,
  ToolResult,
  HookName,
  HookHandler,
  SemanticEntry,
  EpisodicEntry,
  Permission,
} from './types.js';
