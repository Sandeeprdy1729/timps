import { AcpBus, AcpSwarm, taskMessage, resultMessage, heartbeatMessage } from '../src/index.js';

describe('AcpBus', () => {
  it('delivers a direct task message to the target agent', async () => {
    const bus = new AcpBus();
    const received: unknown[] = [];

    bus.onMessage('agent-b', (msg) => { received.push(msg); });

    const msg = taskMessage('agent-a', 'agent-b', 'do something');
    await bus.send(msg);

    expect(received).toHaveLength(1);
    expect((received[0] as ReturnType<typeof taskMessage>).prompt).toBe('do something');
    expect((received[0] as ReturnType<typeof taskMessage>).from).toBe('agent-a');
  });

  it('throws when sending to an unregistered agent', async () => {
    const bus = new AcpBus();
    const msg = taskMessage('a', 'unknown-agent', 'hello');
    await expect(bus.send(msg)).rejects.toThrow('No handlers registered');
  });

  it('broadcasts to all agents', async () => {
    const bus = new AcpBus();
    const logs: string[] = [];
    bus.onMessage('a', () => { logs.push('a'); });
    bus.onMessage('b', () => { logs.push('b'); });

    await bus.broadcast({ type: 'broadcast', from: 'system', content: 'hello all' });
    expect(logs.sort()).toEqual(['a', 'b']);
  });

  it('delivers result messages', async () => {
    const bus = new AcpBus();
    const received: unknown[] = [];
    bus.onMessage('planner', (msg) => { received.push(msg); });

    const res = resultMessage('task-123', 'coder', 'planner', 'done', true);
    await bus.send(res);
    expect(received).toHaveLength(1);
    expect((received[0] as ReturnType<typeof resultMessage>).success).toBe(true);
  });

  it('heartbeat messages broadcast correctly', async () => {
    const bus = new AcpBus();
    const logs: string[] = [];
    bus.onMessage('a', () => { logs.push('a'); });

    await bus.broadcast(heartbeatMessage('orchestrator'));
    expect(logs).toContain('a');
  });

  it('lists registered agents', () => {
    const bus = new AcpBus();
    bus.onMessage('agent-1', () => {});
    bus.onMessage('agent-2', () => {});
    expect(bus.agents().sort()).toEqual(['agent-1', 'agent-2']);
  });
});

describe('AcpSwarm', () => {
  it('delegates to a named role', async () => {
    const swarm = new AcpSwarm();
    const received: string[] = [];

    swarm.assignRole('coder', 'coder-instance-1');
    swarm.assignRole('planner', 'planner-instance-1');
    swarm.bus.onMessage('coder-instance-1', (msg) => {
      if (msg.type === 'task') received.push(msg.prompt);
    });

    await swarm.delegateToRole('planner', 'coder', 'implement auth');
    expect(received).toEqual(['implement auth']);
  });

  it('throws when delegating to an unregistered role', async () => {
    const swarm = new AcpSwarm();
    await expect(
      swarm.delegateToRole('planner', 'nonexistent', 'do task')
    ).rejects.toThrow('Role not found');
  });

  it('listRoles returns all role assignments', () => {
    const swarm = new AcpSwarm();
    swarm.assignRole('planner', 'p1');
    swarm.assignRole('coder', 'c1');
    const roles = swarm.listRoles();
    expect(roles).toHaveLength(2);
    expect(roles.find((r) => r.role === 'planner')?.agentId).toBe('p1');
  });
});
