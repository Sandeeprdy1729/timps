// ── TIMPS Gmail — Gmail API client ──
// Minimal fetch-based wrapper over the Gmail REST API with base64url decoding
// and HTML-stripping so email bodies become plain text for the summarizer.

import { getAccessToken } from './oauth.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface GmailHeaders {
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  [k: string]: string | undefined;
}

export interface ExtractedEmail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  labels: string[];
  bodyText: string;
  internalDate: number;
}

export interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface GmailRawMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string; size?: number };
    parts?: GmailPayloadPart[];
  };
}

export interface GmailPayloadPart {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number };
  parts?: GmailPayloadPart[];
}

async function gmailFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gmail API error ${res.status}: ${body.slice(0, 300)}`);
  }
  return res;
}

export async function getProfileEmail(accessToken?: string): Promise<string> {
  const token = accessToken ?? (await getAccessToken());
  const res = await fetch(`${API}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Profile request failed ${res.status}`);
  const data = (await res.json()) as { emailAddress?: string };
  return data.emailAddress ?? 'unknown';
}

export async function listMessageIds(query: string, maxResults = 50): Promise<GmailListResponse> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const res = await gmailFetch(`/messages?${params.toString()}`);
  return (await res.json()) as GmailListResponse;
}

export async function getRawMessage(id: string): Promise<GmailRawMessage> {
  const res = await gmailFetch(`/messages/${id}?format=full`);
  return (await res.json()) as GmailRawMessage;
}

function headerValue(message: GmailRawMessage, name: string): string {
  const headers = message.payload?.headers ?? [];
  const found = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value?.trim() ?? '';
}

/** Recursively collect the plain-text content of a Gmail payload. */
export function decodePayloadBody(payload?: { body?: { data?: string }; parts?: GmailPayloadPart[] }): string {
  if (!payload) return '';
  const chunks: string[] = [];
  const ownData = payload.body?.data;
  if (ownData) chunks.push(decodeBase64Url(ownData));
  for (const part of payload.parts ?? []) {
    chunks.push(decodePayloadBody(part));
  }
  return chunks.join('\n');
}

export function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const text = Buffer.from(padded, 'base64').toString('utf-8');
  return stripHtml(text);
}

function stripHtml(text: string): string {
  if (!/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractEmail(message: GmailRawMessage): ExtractedEmail {
  const bodyText = decodePayloadBody(message.payload ?? {});
  return {
    id: message.id,
    threadId: message.threadId,
    from: headerValue(message, 'From'),
    to: headerValue(message, 'To'),
    subject: headerValue(message, 'Subject') || '(No Subject)',
    date: headerValue(message, 'Date'),
    snippet: message.snippet ?? '',
    labels: message.labelIds ?? [],
    bodyText: bodyText.slice(0, 20000),
    internalDate: Number(message.internalDate ?? Date.now()),
  };
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}