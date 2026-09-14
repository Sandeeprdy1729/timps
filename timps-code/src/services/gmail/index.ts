// ── TIMPS Gmail — public surface ──
// A self-contained email app: connect Gmail, sync emails into
// ~/.timps/gmail, and store distilled knowledge into TIMPS memory.

export * from './storage.js';
export * from './client.js';
export * from './summarize.js';
export * from './sync.js';
export {
  connectGmail,
  disconnectGmail,
  getAccessToken,
  hasValidTokens,
  refreshAccessToken,
  persistClientCredsFromGoogleJson,
  gmailCredentialCommand,
  GMAIL_SCOPE,
} from './oauth.js';