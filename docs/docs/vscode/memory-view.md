---
sidebar_position: 2
---

# Memory Layers View

The Memory Layers view is a native VS Code tree view in the TIMPS sidebar that shows all three memory layers live.

## Opening the view

Click the TIMPS icon in the Activity Bar → expand **Memory Layers**.

## Structure

```
🧠 Semantic Facts (42)
  ├── [architecture] Uses event sourcing for orders   ★★ accessed 5× 2026-05-01
  ├── [pattern] Always use zod for API input validation   ★ accessed 2× 2026-04-28
  └── ... (top 50 by importance)

📖 Recent Sessions (15)
  ├── Implement payment retry logic   2026-05-07 14:23
  ├── Fix race condition in order processor   2026-05-06 11:05
  └── ...

⚡ Working Memory (3 files)
  ├── Goal: Add webhook retry mechanism
  ├── src/payments/retry.ts
  ├── src/payments/webhook.ts
  └── Pattern: Idempotency key pattern used
```

## Auto-refresh

The view watches `semantic.json`, `episodes.jsonl`, and `working.json` with `fs.watch` and updates automatically when the CLI agent writes new memory.

## Refresh button

Click the **↺** refresh button in the view header to force a reload.

## Commands

| Command | Description |
|---|---|
| `TIMPS: Refresh Memory` | Force-reload all memory layers |
