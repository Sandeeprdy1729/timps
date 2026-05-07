import { describe, it, expect } from 'vitest';
import echoPlugin from '../example/echo.js';

describe('echoPlugin', () => {
  it('has a valid manifest', () => {
    expect(echoPlugin.manifest.name).toBe('@timps/plugin-echo');
    expect(echoPlugin.manifest.version).toBe('0.1.0');
    expect(typeof echoPlugin.manifest.description).toBe('string');
  });

  it('declares the echo command in the manifest', () => {
    expect(echoPlugin.manifest.commands).toHaveLength(1);
    expect(echoPlugin.manifest.commands![0].name).toBe('echo');
  });

  it('echo command joins args with a space', async () => {
    const result = await echoPlugin.commands!.echo(['hello', 'world'], {} as never);
    expect(result).toBe('hello world');
  });

  it('echo command returns empty string for no args', async () => {
    const result = await echoPlugin.commands!.echo([], {} as never);
    expect(result).toBe('');
  });

  it('echo command preserves single arg', async () => {
    const result = await echoPlugin.commands!.echo(['timps'], {} as never);
    expect(result).toBe('timps');
  });
});
