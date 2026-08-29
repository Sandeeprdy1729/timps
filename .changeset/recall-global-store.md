---
"timps-code": minor
---

### `timps recall` / `timps context` now also search the global (home) store

When run **without** `--project`, `timps recall` and `timps context` now search the current project's memory store **plus** the global home-directory store (`~/`), and merge the results (deduped by content, favoring higher scores).

- Shared documents and user-level facts stored in the home store (which the AUTO-CAPTURE instructions direct agents toward for shared docs) are now retrievable from **any** project directory, with no `--project` flag.
- The header now shows `(<dir> + global)` to make it clear both stores were searched.
- Behavior is unchanged when `--project <path>` is given explicitly — that searches only the specified store.

### `timps setup` AUTO-CAPTURE instructions — shared docs go to the GLOBAL store

The instruction block now tells agents where to put what:
- **Shared documents and user-level facts** (docs, reports, preferences, research) → the **global store**, so they're retrievable from any project (since recall always searches global).
- **Project-specific memory** → the current project store.
