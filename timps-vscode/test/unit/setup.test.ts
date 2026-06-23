import { vi } from 'vitest';
vi.mock('vscode', () => ({}));
import { SetupStatus } from '../../src/types';

describe('getSetupStatus logic', () => {
  const makeStatus = (overrides: Partial<SetupStatus> = {}): SetupStatus => ({
    ollamaInstalled: false,
    ollamaRunning: false,
    modelAvailable: false,
    modelName: 'test-model',
    ...overrides,
  });

  it('detects when nothing is installed', () => {
    const s = makeStatus();
    expect(s.ollamaInstalled).toBe(false);
    expect(s.ollamaRunning).toBe(false);
  });

  it('detects when ollama is installed but not running', () => {
    const s = makeStatus({ ollamaInstalled: true });
    expect(s.ollamaInstalled).toBe(true);
    expect(s.ollamaRunning).toBe(false);
  });

  it('detects when ollama is running but model missing', () => {
    const s = makeStatus({ ollamaInstalled: true, ollamaRunning: true });
    expect(s.modelAvailable).toBe(false);
  });

  it('detects when everything is ready', () => {
    const s = makeStatus({ ollamaInstalled: true, ollamaRunning: true, modelAvailable: true });
    expect(s.modelAvailable).toBe(true);
  });
});
