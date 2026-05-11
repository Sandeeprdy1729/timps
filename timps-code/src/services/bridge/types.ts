// TIMPS Code — Bridge Service Types
// Types for remote bridge/session management

export type SpawnMode = 'single-session' | 'worktree' | 'same-dir';

export interface BridgeConfig {
  dir: string;
  machineName: string;
  branch: string;
  gitRepoUrl: string | null;
  maxSessions: number;
  spawnMode: SpawnMode;
  verbose: boolean;
  sandbox: boolean;
  bridgeId: string;
  workerType: string;
  environmentId: string;
  reuseEnvironmentId?: string;
  apiBaseUrl: string;
  sessionIngressUrl: string;
  debugFile?: string;
  sessionTimeoutMs?: number;
}

export type SessionDoneStatus = 'completed' | 'failed' | 'interrupted';

export type SessionActivityType = 'tool_start' | 'text' | 'result' | 'error';

export interface SessionActivity {
  type: SessionActivityType;
  summary: string;
  timestamp: number;
}

export interface SessionHandle {
  sessionId: string;
  done: Promise<SessionDoneStatus>;
  kill(): void;
  forceKill(): void;
  activities: SessionActivity[];
  currentActivity: SessionActivity | null;
  accessToken: string;
  lastStderr: string[];
  writeStdin(data: string): void;
  updateAccessToken(token: string): void;
}

export interface SessionSpawnOpts {
  sessionId: string;
  sdkUrl: string;
  accessToken: string;
  useCcrV2?: boolean;
  workerEpoch?: number;
  onFirstUserMessage?: (text: string) => void;
}

export interface BridgeLogger {
  printBanner(config: BridgeConfig, environmentId: string): void;
  logSessionStart(sessionId: string, prompt: string): void;
  logSessionComplete(sessionId: string, durationMs: number): void;
  logSessionFailed(sessionId: string, error: string): void;
  logStatus(message: string): void;
  logVerbose(message: string): void;
  logError(message: string): void;
  updateIdleStatus(): void;
  updateSessionStatus(
    sessionId: string,
    elapsed: string,
    activity: SessionActivity,
    trail: string[],
  ): void;
  clearStatus(): void;
  setAttached(sessionId: string): void;
  setSessionTitle(sessionId: string, title: string): void;
  removeSession(sessionId: string): void;
}

export interface WorkData {
  type: 'session' | 'healthcheck';
  id: string;
}

export interface WorkResponse {
  id: string;
  type: 'work';
  environment_id: string;
  state: string;
  data: WorkData;
  secret: string;
  created_at: string;
}

export interface PermissionResponseEvent {
  type: 'control_response';
  response: {
    subtype: 'success';
    request_id: string;
    response: Record<string, unknown>;
  };
}

export const DEFAULT_SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export const BRIDGE_LOGIN_INSTRUCTION =
  'Remote Control is only available with TIMPS cloud subscriptions. Please use `/login` to sign in.';

export const BRIDGE_LOGIN_ERROR =
  'Error: You must be logged in to use Remote Control.\n\n' +
  BRIDGE_LOGIN_INSTRUCTION;

export const REMOTE_CONTROL_DISCONNECTED_MSG = 'Remote Control disconnected.';