import { MemoryEngine } from '@timps/memory-core';

const engines = new Map<string, MemoryEngine>();

function getEngine(userId: number | string, projectId?: string): MemoryEngine {
  const key = `${userId}:${projectId ?? 'default'}`;
  let engine = engines.get(key);
  if (!engine) {
    engine = new MemoryEngine(projectId ?? 'default', {
      scope: { userId: String(userId), teamId: projectId },
    });
    engines.set(key, engine);
  }
  return engine;
}

export function getServerQISRD(userId: number | string, projectId?: string) {
  return getEngine(userId, projectId).qisrd;
}
