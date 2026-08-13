import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('@timps-ai/timps-sdk store/recall roundtrip', () => {
  it('stores and recalls through the real memory-core engine', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-e2e-'));
    const { createMemory } = await import('./index.js');
    const memory = await createMemory({ projectPath: dir, dir });

    await memory.store('This project uses tRPC for type-safe APIs');
    const results = await memory.recall('tRPC APIs', { limit: 5 });
    expect(results.length).toBeGreaterThanOrEqual(1);

    const stats = memory.getStats();
    expect(stats.totalMemories).toBeGreaterThanOrEqual(1);

    await memory.dispose();
  });
});
