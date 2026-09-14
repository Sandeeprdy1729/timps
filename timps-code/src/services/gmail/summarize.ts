// ── TIMPS Gmail — Email knowledge summarizer ──
// Distills an email into self-contained, memory-worthy facts using the
// user's configured LLM provider. Falls back to a heuristic extraction when
// no provider is configured or the provider is unavailable.

import type { Message } from '../../config/types.js';
import { getProviderMesh } from '../../models/providerMesh.js';
import { truncate } from './client.js';

export interface EmailSummary {
  emailId: string;
  subject: string;
  from: string;
  date: string;
  facts: string[];
  method: 'llm' | 'heuristic';
  error?: string;
}

const SYSTEM_PROMPT =
  'You are TIMPS, a knowledge extraction engine. Given one email, extract the ' +
  'durable knowledge and any action items it contains. Return ONLY a flat list of ' +
  'bullet points, one fact per line, each starting with "- ". Every bullet must be ' +
  'self-contained and specific. Skip promotional fluff, unboxing/sign-off text, and ' +
  'generic pleasantries. Include names, numbers, deadlines, and decisions when present. ' +
  'Return 1-6 bullets. If the email contains nothing worth remembering, return a single ' +
  'line: "- (nothing notable)"';

export function buildEmailPrompt(email: {
  from: string;
  subject: string;
  date: string;
  bodyText: string;
}): Message[] {
  const body = truncate(email.bodyText, 6000) || '(no body)';
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        `From: ${email.from}`,
        `Date: ${email.date}`,
        `Subject: ${email.subject}`,
        '',
        body,
      ].join('\n'),
    },
  ];
}

function parseFacts(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-*•\s]+/, '').trim())
    .filter((line) => line.length > 8 && line.length < 500)
    .filter((line) => !/^\((nothing notable)\)?$/.test(line))
    .slice(0, 8);
}

export async function summarizeEmail(email: {
  emailId: string;
  from: string;
  subject: string;
  date: string;
  bodyText: string;
}): Promise<EmailSummary> {
  const fallback: EmailSummary = {
    emailId: email.emailId,
    subject: email.subject,
    from: email.from,
    date: email.date,
    facts: [],
    method: 'heuristic',
  };

  try {
    const mesh = getProviderMesh();
    const decision = mesh.route('email summary', { taskType: 'creative' });
    const provider = mesh.createProvider(decision.provider);
    const chunks: string[] = [];
    for await (const ev of provider.stream(buildEmailPrompt(email), [], { temperature: 0.2 })) {
      if (ev.type === 'text') chunks.push(ev.content);
    }
    const facts = parseFacts(chunks.join(''));
    if (facts.length === 0) {
      return { ...fallback, facts: heuristicFacts(email), method: 'heuristic' };
    }
    return { ...fallback, facts, method: 'llm' };
  } catch (err) {
    return {
      ...fallback,
      facts: heuristicFacts(email),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** No-LLM fallback: subject + first substantial sentences, still useful as a fact. */
export function heuristicFacts(email: {
  from: string;
  subject: string;
  bodyText: string;
}): string[] {
  const facts: string[] = [];
  const subjectLine = `Email from ${email.from || 'unknown'}: "${email.subject}"`;
  if (email.subject && email.subject !== '(No Subject)') facts.push(subjectLine);

  const body = email.bodyText.replace(/\s+/g, ' ').trim();
  const sentences = body.match(/[^.!?]+[.!?]+/g) ?? (body ? [body] : []);
  const meaningful = sentences
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 600)
    .slice(0, 2);
  for (const s of meaningful) {
    facts.push(truncate(s, 400));
  }
  if (facts.length === 0 && body) {
    facts.push(truncate(body.slice(0, 300), 300));
  }
  return facts.slice(0, 4);
}

export function formatFactsForStorage(facts: string[], email: { from: string; subject: string }): string[] {
  if (facts.length > 0) return facts;
  return [`Email from ${email.from}: ${email.subject}`];
}