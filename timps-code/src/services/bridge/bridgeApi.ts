// TIMPS Code — Bridge API Client
// API client for remote bridge connections

import { getBridgeAccessToken, getBridgeBaseUrl } from './bridgeConfig.js';
import { getTrustedDeviceToken } from './trustedDevice.js';
import type {
  BridgeConfig,
  WorkResponse,
  PermissionResponseEvent,
} from './types.js';

class BridgeApiClient {
  private baseUrl: string;
  private accessToken: string | undefined;

  constructor(baseUrl?: string, accessToken?: string) {
    this.baseUrl = baseUrl || getBridgeBaseUrl();
    this.accessToken = accessToken || getBridgeAccessToken();
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = this.accessToken || getBridgeAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const trustedDeviceToken = getTrustedDeviceToken();
    if (trustedDeviceToken) {
      headers['X-Trusted-Device-Token'] = trustedDeviceToken;
    }

    return headers;
  }

  async registerBridgeEnvironment(config: BridgeConfig): Promise<{
    environment_id: string;
    environment_secret: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/environments`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        machine_name: config.machineName,
        branch: config.branch,
        git_repo_url: config.gitRepoUrl,
        worker_type: config.workerType,
        max_sessions: config.maxSessions,
        spawn_mode: config.spawnMode,
      }),
    });

    if (!response.ok) {
      throw new Error(`Environment registration failed: ${response.status}`);
    }

    const data = await response.json() as {
      environment_id: string;
      environment_secret: string;
    };

    return data;
  }

  async pollForWork(
    environmentId: string,
    environmentSecret: string,
    signal?: AbortSignal,
    reclaimOlderThanMs?: number,
  ): Promise<WorkResponse | null> {
    const url = new URL(`${this.baseUrl}/api/environments/${environmentId}/work`);
    url.searchParams.set('secret', environmentSecret);
    if (reclaimOlderThanMs) {
      url.searchParams.set('reclaim_older_than_ms', String(reclaimOlderThanMs));
    }

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
      signal,
    });

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Bridge authentication failed. Please login again.');
      }
      return null;
    }

    return response.json() as Promise<WorkResponse>;
  }

  async acknowledgeWork(
    environmentId: string,
    workId: string,
    sessionToken: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/environments/${environmentId}/work/${workId}/ack`,
      {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'X-Session-Token': sessionToken,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to acknowledge work: ${response.status}`);
    }
  }

  async stopWork(environmentId: string, workId: string, force: boolean): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/environments/${environmentId}/work/${workId}?force=${force}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to stop work: ${response.status}`);
    }
  }

  async deregisterEnvironment(environmentId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/environments/${environmentId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      },
    );

    if (!response.ok && response.status !== 404) {
      console.warn(`Environment deregistration failed: ${response.status}`);
    }
  }

  async sendPermissionResponseEvent(
    sessionId: string,
    event: PermissionResponseEvent,
    sessionToken: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/sessions/${sessionId}/events`,
      {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'X-Session-Token': sessionToken,
        },
        body: JSON.stringify(event),
      },
    );

    if (!response.ok) {
      console.warn(`Permission response failed: ${response.status}`);
    }
  }

  async archiveSession(sessionId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/sessions/${sessionId}/archive`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      console.warn(`Session archive failed: ${response.status}`);
    }
  }

  async reconnectSession(environmentId: string, sessionId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/environments/${environmentId}/sessions/${sessionId}/reconnect`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`Session reconnect failed: ${response.status}`);
    }
  }

  async heartbeatWork(
    environmentId: string,
    workId: string,
    sessionToken: string,
  ): Promise<{ lease_extended: boolean; state: string }> {
    const response = await fetch(
      `${this.baseUrl}/api/environments/${environmentId}/work/${workId}/heartbeat`,
      {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'X-Session-Token': sessionToken,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Heartbeat failed: ${response.status}`);
    }

    return response.json() as Promise<{ lease_extended: boolean; state: string }>;
  }

  async createSession(
    environmentId: string,
    title?: string,
    events?: Array<{ type: 'event'; data: unknown }>,
  ): Promise<string | null> {
    const response = await fetch(
      `${this.baseUrl}/api/environments/${environmentId}/sessions`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ title, events }),
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { id: string };
    return data.id;
  }
}

let bridgeClient: BridgeApiClient | null = null;

export function getBridgeApiClient(): BridgeApiClient {
  if (!bridgeClient) {
    bridgeClient = new BridgeApiClient();
  }
  return bridgeClient;
}

export { BridgeApiClient };