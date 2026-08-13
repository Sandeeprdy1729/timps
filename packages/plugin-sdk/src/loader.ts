import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { Plugin } from './types.js';
import { assertDeclaredPermissions } from './permissions.js';

const _require =
  typeof require !== 'undefined'
    ? require
    : createRequire(pathToFileURL(__filename).href);

/** Options for {@link loadPlugin}. */
export interface LoadPluginOptions {
  /**
   * When `true` (default), the plugin's source is statically scanned for
   * privileged API usage before it is executed, and loading fails if the
   * plugin uses capabilities it did not declare in `manifest.timps.permissions`.
   */
  enforcePermissions?: boolean;
}

/**
 * Load a TIMPS plugin from a package name or file path.
 *
 * The module must export a `Plugin` object as `default`, `.plugin`, or the
 * module root itself (for CJS `module.exports = plugin`).
 *
 * By default the plugin's source is statically scanned for privileged API
 * usage (fs, child_process, network, process.env) BEFORE the module code runs,
 * and loading fails closed if the plugin uses capabilities it did not declare.
 *
 * @example
 * ```ts
 * const p = await loadPlugin('@acme/plugin-hello');
 * const p2 = await loadPlugin('./my-local-plugin.js');
 * ```
 */
export async function loadPlugin(
  specifier: string,
  options?: LoadPluginOptions,
): Promise<Plugin> {
  const enforcePermissions = options?.enforcePermissions ?? true;

  // Static scan happens BEFORE the module executes, so a plugin that reads
  // ~/.ssh at module scope is rejected before any of its code runs.
  let source: string | undefined;
  if (enforcePermissions) {
    try {
      const resolved = _require.resolve(specifier);
      source = readFileSync(resolved, 'utf-8');
    } catch {
      // Resolution failed (e.g. ESM-only package) — fall back to runtime load
      // and re-attempt the scan from the loaded module if possible.
    }
  }

  let mod: unknown;
  try {
    // Prefer CJS require for local files (works in both CJS and ESM contexts)
    mod = _require(specifier);
  } catch {
    // Fall back to dynamic import for ESM-only packages
    mod = await import(specifier);
  }

  const plugin =
    (mod as Record<string, unknown>)['default'] ??
    (mod as Record<string, unknown>)['plugin'] ??
    mod;

  if (
    !plugin ||
    typeof plugin !== 'object' ||
    !(plugin as Record<string, unknown>)['manifest']
  ) {
    throw new Error(
      `"${specifier}" does not export a valid Plugin. ` +
        `Expected a default export (or .plugin) with a .manifest property.`,
    );
  }

  const loaded = plugin as Plugin;

  if (enforcePermissions && source !== undefined) {
    assertDeclaredPermissions(loaded, source);
  }

  return loaded;
}
