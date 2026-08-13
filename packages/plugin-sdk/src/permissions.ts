import type { Permission, Plugin } from './types.js';

/** The full set of permissions a plugin may declare. */
export const VALID_PERMISSIONS: readonly Permission[] = [
  'network',
  'memory:read',
  'memory:write',
  'fs:read',
  'fs:write',
  'env:read',
  'process:spawn',
];

/**
 * Privileged API usage patterns and the permission each one requires.
 * Static scan results are advisory, not a proof of safety — but a plugin that
 * uses these APIs without declaring the corresponding permission is rejected
 * at load time (fail closed).
 */
const PRIVILEGED_PATTERNS: Array<{ permission: Permission; pattern: RegExp }> = [
  // Filesystem — importing fs is read access at minimum; fs:write requires
  // evidence of a write/delete API (M69: keeps read-only fs plugins from being
  // forced to over-declare write capability).
  { permission: 'fs:read', pattern: /require\(['"](?:node:)?fs['"]\)|from ['"](?:node:)?fs['"]|fs\.(readFile|readFileSync|readdir|readdirSync|existsSync|statSync|lstatSync|createReadStream|openSync|readdirSync)/g },
  { permission: 'fs:write', pattern: /fs\.(writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|unlink|unlinkSync|rm|rmSync|rename|renameSync|copyFile|copyFileSync|createWriteStream|truncateSync)/g },
  // Process execution
  { permission: 'process:spawn', pattern: /require\(['"](?:node:)?child_process['"]\)|from ['"](?:node:)?child_process['"]|execSync|execFileSync|spawnSync|\.exec\(|\.spawn\(|\.fork\(|child_process\./g },
  // Network
  { permission: 'network', pattern: /require\(['"](?:node:)?(?:http|https|net|dns|tls|dgram)['"]\)|from ['"](?:node:)?(?:http|https|net|dns|tls|dgram)['"]|\bfetch\s*\(|new\s+WebSocket\s*\(|\.request\s*\(/g },
  // Environment
  { permission: 'env:read', pattern: /\bprocess\.env\b|process\.getuid|process\.getgid/g },
];

/** Code patterns that defeat static analysis entirely — flagged as unverifiable. */
const UNVERIFIABLE_PATTERNS: RegExp[] = [
  /\beval\s*\(/g,
  /\bnew\s+Function\s*\(/g,
];

/** Result of a static permission scan over plugin source. */
export interface PermissionScanResult {
  /** Permissions the source appears to require. */
  required: Set<Permission>;
  /** True when the source contains eval/Function() — the scan cannot verify it. */
  unverifiable: boolean;
}

/** Scan plugin source for privileged API usage. */
export function scanForPermissions(source: string): PermissionScanResult {
  const required = new Set<Permission>();
  let unverifiable = false;

  for (const { permission, pattern } of PRIVILEGED_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) required.add(permission);
  }

  for (const pattern of UNVERIFIABLE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) unverifiable = true;
  }

  return { required, unverifiable };
}

/**
 * Fail-closed permission gate. Throws when the plugin's source uses privileged
 * APIs that are not declared in `manifest.timps.permissions`, or when the
 * source contains eval/Function() and therefore cannot be statically verified.
 */
export function assertDeclaredPermissions(
  plugin: Plugin,
  source: string,
  options?: { allowUnverifiable?: boolean },
): void {
  const scan = scanForPermissions(source);

  if (scan.unverifiable && !options?.allowUnverifiable) {
    throw new Error(
      `Plugin "${plugin.manifest.name}" contains eval()/Function() code that cannot be statically verified. ` +
        `Refusing to load. Remove dynamic code evaluation so permissions can be enforced.`,
    );
  }

  const declared = plugin.manifest.timps?.permissions ?? [];
  const missing = [...scan.required].filter((p) => !declared.includes(p));
  if (missing.length > 0) {
    throw new Error(
      `Plugin "${plugin.manifest.name}" uses privileged APIs (${missing.join(', ')}) that are not ` +
        `declared in manifest.timps.permissions (declared: ${declared.join(', ') || 'none'}). ` +
        `Refusing to load. Add the required permissions to the manifest.`,
    );
  }
}

/** Validate declared permission strings against the known union. */
export function invalidPermissions(permissions: Permission[]): Permission[] {
  return permissions.filter((p) => !(VALID_PERMISSIONS as readonly string[]).includes(p));
}

/**
 * Derive a human-facing risk level for a plugin tool from the plugin's declared
 * permissions. A plugin that declares nothing is low-risk by default — but the
 * loader rejects it if its source actually uses privileged APIs.
 */
export function deriveToolRisk(
  permissions: Permission[] | undefined,
): 'low' | 'medium' | 'high' {
  const declared = permissions ?? [];
  if (declared.includes('process:spawn') || declared.includes('network') || declared.includes('fs:write')) {
    return 'high';
  }
  if (declared.includes('fs:read') || declared.includes('env:read')) {
    return 'medium';
  }
  return 'low';
}
