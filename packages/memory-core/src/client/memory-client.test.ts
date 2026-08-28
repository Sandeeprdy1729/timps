// ── @timps/memory-core — M48: MemoryClient must keep a custom gRPC address ──
// Regression: the constructor accepted options.grpcAddress, but setToken(),
// authenticate(), and setTransport() blindly recreated MemoryGrpcClient with a
// hardcoded 'localhost:4101', silently dropping a custom address after login.
// This file proves the configured address survives every gRPC reinstantiation.

import { describe, it, expect, vi } from 'vitest';
import { MemoryClient } from './MemoryClient.js';

/**
 * Return the address the underlying MemoryGrpcClient was built with.
 * Depending on the grpc.ts arrangement the address lives on `this.options` of
 * the MemoryGrpcClient wrapper.
 */
function wrappedAddress(client: MemoryClient): string | undefined {
  const grpc: any = client.getGrpcClient();
  if (!grpc) return undefined;
  return grpc.options?.address ?? grpc.targetURL?.host ?? grpc.target;
}

describe('MemoryClient — custom gRPC address survives token-set / reconnect', () => {
  it('keeps the custom grpcAddress across setToken()', () => {
    const client = new MemoryClient({
      transport: 'grpc',
      grpcAddress: 'memory.internal:4101',
    });
    expect(wrappedAddress(client)).toBe('memory.internal:4101');

    client.setToken('tok');
    expect(wrappedAddress(client)).toBe('memory.internal:4101');
  });

  it('keeps the custom grpcAddress across authenticate()', async () => {
    const client = new MemoryClient({
      grpcAddress: 'memory.internal:4101',
    });
    // authenticate() uses REST to fetch a token; stub global fetch.
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'sess-token' }),
    } as any);

    try {
      const token = await client.authenticate('u1', 's3cret');
      expect(token).toBe('sess-token');
      expect(wrappedAddress(client)).toBe('memory.internal:4101');
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('keeps the custom grpcAddress across setTransport()', () => {
    const client = new MemoryClient({
      transport: 'rest',
      grpcAddress: 'memory.internal:4101',
    });
    expect(client.getGrpcClient()).toBeNull();

    client.setTransport('grpc');
    expect(wrappedAddress(client)).toBe('memory.internal:4101');
  });

  it('defaults to localhost:4101 when no address is given', () => {
    const client = new MemoryClient({});
    expect(wrappedAddress(client)).toBe('localhost:4101');
  });
});