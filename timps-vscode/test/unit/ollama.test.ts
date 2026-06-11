import { checkOllamaRunning, checkModelExists, listModels } from '../../src/ollama';

describe('ollama module', () => {
  it('exports expected functions', () => {
    expect(typeof checkOllamaRunning).toBe('function');
    expect(typeof checkModelExists).toBe('function');
    expect(typeof listModels).toBe('function');
  });

  it('checkOllamaRunning returns false when server is down', async () => {
    const result = await checkOllamaRunning('http://127.0.0.1:1');
    expect(result).toBe(false);
  });

  it('listModels throws when server is down', async () => {
    await expect(listModels('http://127.0.0.1:1')).rejects.toThrow();
  });

  it('checkModelExists returns false when server is down', async () => {
    const result = await checkModelExists('http://127.0.0.1:1', 'some-model');
    expect(result).toBe(false);
  });
});
