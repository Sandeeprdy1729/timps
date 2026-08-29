---
"timps-code": patch
---

### `timps setup` instructions — auto-capture is now explicitly MANDATORY

The instruction block `timps setup` installs into every agent's rule file no longer just suggests "store as you go". It now states that **AUTO-CAPTURE IS MANDATORY (do not ask first)** and tells agents to call `timps_store_memory` on their own whenever the user:

- shares, pastes, attaches, or links a document / report / spec / README / research / meeting notes / any substantial text (store a digest),
- states a preference, decision, project fact, goal, constraint, or opinion,
- sends a long message with several ideas (batch into 2–5 concise entries, never one blob),
- gives requirements for a feature or task.

This makes shared docs and messages persist automatically even when the agent is also doing other work in the same turn, instead of capture being skipped. Existing installed blocks are left untouched (idempotent) — re-run `timps setup` only installs the new text into fresh or uninstalled targets.
