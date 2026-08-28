// ── @timps/memory-core — migration async helpers ──
// Migrations must work against both synchronous backends (FileBackend,
// InMemoryBackend, SQLiteBackend) and asynchronous backends
// (PostgresBackend, RedisBackend, QdrantBackend). These helpers detect
// thenable results so a migration body can branch on sync vs async.

/** Duck-type check for a thenable (Promise) result. */
export function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    value != null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}
