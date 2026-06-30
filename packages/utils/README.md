# @timps/utils

Retry, circuit breaker, rate limiter, queue, debounce, throttle, and LRU cache utilities.

```typescript
import { retry, CircuitBreaker, RateLimiter, Queue, Debouncer, Throttler, LRU, MultiLimiter } from '@timps/utils'

// Retry with exponential backoff
await retry(() => fetchData(), { maxAttempts: 3, initialDelay: 1000 })

// Circuit breaker with states: CLOSED → OPEN → HALF_OPEN
const breaker = new CircuitBreaker()
await breaker.execute(() => fetchData())

// Sliding window rate limiter
const limiter = new RateLimiter({ maxRequests: 60, windowMs: 60000 })
await limiter.acquire()

// Multi-key rate limiter
const multi = new MultiLimiter({ maxRequests: 60, windowMs: 60000 })
await multi.acquire('user-1')

// Concurrency-limited queue
const queue = new Queue<string>({ concurrency: 5 })
await queue.enqueue('task')

// Debounce / throttle
const debouncer = new Debouncer<string>(300)
const throttler = new Throttler(500)

// LRU cache
const cache = new LRU<string, number>({ maxSize: 100 })
cache.set('key', 42)
cache.get('key')
```

## Exports

`retry()`, `withRetry()`, `RetryOptions`, `RetryableError`, `CircuitBreaker`, `RateLimiter`, `MultiLimiter`, `Queue`, `Debouncer`, `Throttler`, `LRU`
