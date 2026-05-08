# TIMPS - Utilities Package

Common utilities for TIMPS.

## Utilities

### Retry

```typescript
import { retry } from '@timps/utils';

const result = await retry(() => fetchData(), {
  maxAttempts: 3,
  initialDelay: 1000,
});
```

### Circuit Breaker

```typescript
import { CircuitBreaker } from '@timps/utils';

const breaker = new CircuitBreaker();
const result = await breaker.execute(() => fetchData());
```

### Rate Limiter

```typescript
import { RateLimiter } from '@timps/utils';

const limiter = new RateLimiter({ maxRequests: 60, windowMs: 60000 });
await limiter.acquire();
```

### Queue

```typescript
import { Queue } from '@timps/utils';

const queue = new Queue<Task>(concurrency: 5);
await queue.enqueue(task);
```

### Debouncer

```typescript
import { Debouncer } from '@timps/utils';

const debouncer = new Debouncer(300);
const debouncedFn = debouncer.debounce(fn);
```

### LRU Cache

```typescript
import { LRU } from '@timps/utils';

const cache = new LRU<string, number>(maxSize: 100);
cache.set('key', value);
const value = cache.get('key');
```