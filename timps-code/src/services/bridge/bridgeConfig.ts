// TIMPS Code — Bridge Configuration
// Auth and URL resolution for bridge connections

import { getOAuthConfig } from '../oauth/index.js';
import { loadConfig } from '../../config/config.js';

export function getBridgeAccessToken(): string | undefined {
  const envToken = process.env.TIMPS_BRIDGE_TOKEN;
  if (envToken) return envToken;

  const cfg = loadConfig();
  return cfg.apiKey || undefined;
}

export function getBridgeBaseUrl(): string {
  const envUrl = process.env.TIMPS_BRIDGE_BASE_URL;
  if (envUrl) return envUrl;

  const oauthConfig = getOAuthConfig();
  return oauthConfig.AUTHORIZE_URL.replace('/oauth/authorize', '');
}

export function getBridgeConfig() {
  return {
    baseUrl: getBridgeBaseUrl(),
    accessToken: getBridgeAccessToken(),
    sessionTimeout: 24 * 60 * 60 * 1000,
    maxSessions: 5,
  };
}