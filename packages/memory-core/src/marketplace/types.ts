export type Permission =
  | 'network'
  | 'memory:read'
  | 'memory:write'
  | 'fs:read'
  | 'fs:write'
  | 'env:read'
  | 'process:spawn';

export interface PluginDependency {
  name: string;
  version: string;
}

export type HookName = 'post-recall' | 'pre-store' | 'post-store' | 'pre-tool' | 'post-tool' | 'on-error' | 'on-session-end';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  timps: {
    version: string;
    permissions: Permission[];
    dependencies?: Record<string, string>;
    hooks?: HookName[];
    tools?: string[];
  };
}

export interface PluginPackage {
  manifest: PluginManifest;
  /** Base64-encoded tarball or WASM binary */
  payload: string;
  /** 'wasm' | 'js' */
  format: 'wasm' | 'js';
  /** SHA-256 hash of the payload */
  checksum: string;
  /** File size in bytes */
  size: number;
}

export interface PluginRelease {
  id: string;
  name: string;
  version: string;
  manifest: PluginManifest;
  format: 'wasm' | 'js';
  checksum: string;
  size: number;
  downloads: number;
  publishedAt: number;
  status: 'pending_review' | 'approved' | 'rejected' | 'deprecated';
  reviewNotes?: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  author: string;
  license: string;
  tags: string[];
  permissions: Permission[];
  releases: PluginRelease[];
  latestVersion: string;
  totalDownloads: number;
  avgRating: number;
  reviewCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface RatingReview {
  id: string;
  pluginId: string;
  userId: string;
  rating: number;
  review?: string;
  createdAt: number;
}

export interface AnalyticsEvent {
  pluginId: string;
  version: string;
  userId?: string;
  event: 'execute' | 'install' | 'uninstall' | 'error';
  success: boolean;
  latencyMs?: number;
  errorMessage?: string;
  timestamp: number;
}

export interface SubmissionRequest {
  manifest: PluginManifest;
  payload: string;
  format: 'wasm' | 'js';
  checksum: string;
}

export interface SubmissionResult {
  id: string;
  status: PluginRelease['status'];
  scanResults: ScanResult[];
  message: string;
}

export interface ScanResult {
  rule: string;
  severity: 'error' | 'warn' | 'info';
  passed: boolean;
  message: string;
}

export interface DependencyNode {
  name: string;
  version: string;
  dependencies: DependencyNode[];
}

export interface ResolutionResult {
  graph: DependencyNode;
  flat: Map<string, string>;
  conflicts: string[];
}
