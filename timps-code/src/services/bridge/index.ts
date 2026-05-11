// TIMPS Code — Bridge Service
// Remote bridge and session management

export * from './types.js';
export * from './bridgeConfig.js';
export * from './jwtUtils.js';
export * from './trustedDevice.js';
export * from './sessionManager.js';
export { BridgeApiClient, getBridgeApiClient } from './bridgeApi.js';
export { BridgeManager, getBridgeManager } from './manager.js';

import { BridgeManager, getBridgeManager } from './manager.js';
import type { BridgeConfig } from './types.js';

export async function startBridge(options: Partial<BridgeConfig> & { dir?: string }): Promise<BridgeManager> {
  const manager = getBridgeManager();

  await manager.initialize({
    ...options,
    dir: options.dir || process.cwd(),
  });

  await manager.connect();
  return manager;
}

export async function stopBridge(): Promise<void> {
  const manager = getBridgeManager();
  await manager.disconnect();
}

export function isBridgeConnected(): boolean {
  const manager = getBridgeManager();
  return manager.getIsRunning();
}

export function getBridgeEnvironmentId(): string | null {
  const manager = getBridgeManager();
  return manager.getEnvironmentId();
}