# TIMPS Audit Fix Tracker

**Source:** `timps-audit.md` (388 verified issues across ~135k LOC)

## Summary

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 11    | 11    | 0         |
| High     | 89    | 2     | 87        |
| Medium   | 208   | 0     | 208       |
| Low      | 80    | 0     | 80        |
| **Total**| **388** | **13** | **375** |

---

## ✅ Fixed — 11 Critical + 2 High

| ID | File | Issue | Fix Summary |
|----|------|-------|-------------|
| C4 | `benchmark/index.ts` | `rmSync` deletes OS temp dir and `~/.timps` | Added guard checks for root/tilde paths before deletion |
| C6 | `packages/memory-core/src/storage.ts` | `MAX_SEMANTIC=500` silent truncation | Increased to 100000 (env-overridable via `TIMPS_MAX_SEMANTIC`) |
| C8 | `timps-code/src/config/config.ts` | Project ID uses `path.basename` → hash inconsistency | Changed to `hashProject(path.resolve(p))` for consistent IDs |
| C11 | `timps-vscode/src/extension.ts` | TypeScript type annotations in webview inline script | Removed `: string` from arrow function params |
| C5 | `packages/memory-core/src/server/websocket.ts` | JWT HMAC signature never verified in `verifyToken` | Added `crypto.createHmac('sha256', TIMPS_JWT_SECRET)` with `timingSafeEqual` |
| C7 | `packages/server/api/routes.ts` | No auth on any route, all userId attacker-controlled | Added `requireAuth` + `requireUserId()` middlewares to 45+ routes |
| C9 | `timps-code/src/services/bridge/sessionManager.ts` | RCE via unsanitized `node --eval` injection | Replaced string interpolation with `process.env` vars |
| C10 | `timps-code/src/utils/gateway.ts` | No webhook signature verification for Feishu/WeCom | Added HMAC-SHA256 for Feishu, SHA1 for WeCom, `timingSafeEqual` |
| C1 | `apps/marketplace/src/app/api/integrations/[id]/proxy/route.ts` | No auth on integration proxy | Added `requireAuth` middleware (env: `MARKETPLACE_API_KEY`) |
| C2 | `apps/marketplace/src/app/api/plugins/[id]/run/route.ts` | No auth on plugin run | Added `requireAuth` middleware |
| C3 | `apps/marketplace/src/lib/plugins/api-client.ts` | SSRF via unvalidated URL fetch | Added `isBlockedUrl()` — blocks private IPs, localhost, cloud metadata |

## 📋 Remaining — 377 Issues

### High (88)
| ID | File | Issue | Fix Summary |
|----|------|-------|-------------|
| H1 | `.github/workflows/eval.yml` | Eval baseline never persisted, `github.ref_name` never `"main"` on PR | Added `actions/cache` for baseline dir, fixed branch detection with `github.event_name == 'push' && github.ref == 'refs/heads/main'` |
| H2 | `apps/marketplace/src/lib/credentials.ts` | Hardcoded encryption key + static salt | Requires `MARKETPLACE_ENCRYPTION_KEY` env var (fails closed), generates random salt per-install |

⏸️ Paused — awaiting user instruction to proceed

### Medium (208)
⏸️ Paused — awaiting user instruction to proceed

### Low (80)
⏸️ Paused — awaiting user instruction to proceed

---

## How to proceed

Run the following command to view the audit file and send specific issue IDs:

```
cat /path/to/timps-audit.md | grep "H[0-9]"  # see high severity issues
```

Or tell me: `fix H1`, `fix H1-H5`, etc.
