import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { Plugin } from './types.js';

const _require =
  typeof require !== 'undefined'
    ? require
    : createRequire(pathToFileURL(__filename).href);

/**
 * Load a TIMPS plugin from a package name or file path.
 *
 * The module must export a `Plugin` object as `default`, `.plugin`, or the
 * module root itself (for CJS `module.exports = plugin`).
 *
 * @example
 * ```ts
 * const p = await loadPlugin('@acme/plugin-hello');
 * const p2 = await loadPlugin('./my-local-plugin.js');
 * ```
 */
export async function loadPlugin(specifier: string): Promise<Plugin> {
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

  return plugin as Plugin;
}
