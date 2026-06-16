// ── Tool 23: ProspectiveTrigger (intelligence tool) ──
// Manages "when X happens, surface Y" triggers that wake up memory
// based on context matching. Delegates to the L17 layer.

import { ProspectiveTrigger as L17ProspectiveTrigger } from '../ProspectiveTrigger.js';
export type { Trigger, TriggerMatch } from '../ProspectiveTrigger.js';

export class ProspectiveTriggerTool {
  private impl: L17ProspectiveTrigger;

  constructor(dir: string) {
    this.impl = new L17ProspectiveTrigger(dir);
  }

  get inner(): L17ProspectiveTrigger {
    return this.impl;
  }

  register(input: { when: string; surface: string; memoryId: string }) {
    return this.impl.register(input);
  }

  evaluate(context: string) {
    return this.impl.evaluate(context);
  }

  remove(id: string) {
    return this.impl.remove(id);
  }

  list() {
    return this.impl.list();
  }
}
