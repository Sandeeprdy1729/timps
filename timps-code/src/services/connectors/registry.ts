// ── TIMPS Connectors — provider registry ──
// Single source of truth for the generic connector sync services. The IDs and
// token URIs here mirror the Tauri engine (packages/timps-desktop/…/connectors.rs)
// so the desktop app's OAuth flow and the CLI's sync read from the same
// ~/.timps/<id>/ folders.
//
// Only gmail has its own service module (~/services/gmail); the others share
// this generic pipeline: fetch recent items → store raw → distill → memory.

export interface ConnectorDef {
  id: string;
  display: string;
  tokenUri: string;
  /** Provider returns a refresh_token usable on tokenUri (with client_secret when provided). */
  refreshable: boolean;
  /** Some token endpoints need a scope resent on refresh (e.g. Microsoft). */
  scopeHint?: string;
  /** Default cap on items fetched per sync. */
  maxItems: number;
}

export const CONNECTORS: ConnectorDef[] = [
  {
    id: 'calendar',
    display: 'Google Calendar',
    tokenUri: 'https://oauth2.googleapis.com/token',
    refreshable: true,
    maxItems: 25,
  },
  {
    id: 'drive',
    display: 'Google Drive',
    tokenUri: 'https://oauth2.googleapis.com/token',
    refreshable: true,
    maxItems: 20,
  },
  {
    id: 'github',
    display: 'GitHub',
    tokenUri: 'https://github.com/login/oauth/access_token',
    refreshable: true,
    maxItems: 30,
  },
  {
    id: 'notion',
    display: 'Notion',
    tokenUri: 'https://api.notion.com/v1/oauth/token',
    refreshable: false,
    maxItems: 16,
  },
  {
    id: 'slack',
    display: 'Slack',
    tokenUri: 'https://slack.com/api/oauth.v2.access',
    refreshable: true,
    maxItems: 25,
  },
  {
    id: 'linear',
    display: 'Linear',
    tokenUri: 'https://api.linear.app/oauth/token',
    refreshable: false,
    maxItems: 20,
  },
  {
    id: 'ms365',
    display: 'Microsoft 365',
    tokenUri: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    refreshable: true,
    scopeHint: 'User.Read Mail.Read Calendars.Read Files.Read.All offline_access',
    maxItems: 25,
  },
];

export function connectorDef(id: string): ConnectorDef | null {
  return CONNECTORS.find((c) => c.id === id) ?? null;
}