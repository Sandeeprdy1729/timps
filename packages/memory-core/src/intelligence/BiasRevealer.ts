// ── Tool 24: BiasRevealer (intelligence tool) ──
// Reveals over- and under-representation in saved memory.
// Delegates to the L18 layer.

import type { StorageBackend } from '../backends/types.js';
import { BiasRevealer as L18BiasRevealer } from '../BiasRevealer.js';
export type { BiasReport } from '../BiasRevealer.js';

export class BiasRevealerTool {
  private impl: L18BiasRevealer;
  private _backend?: StorageBackend;

  constructor(dir: string, backend?: StorageBackend) {
    this._backend = backend;
    this.impl = new L18BiasRevealer(dir);
  }

  reveal() {
    return this.impl.reveal();
  }
}
