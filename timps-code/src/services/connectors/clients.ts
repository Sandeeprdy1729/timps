// ── TIMPS Connectors — per-provider fetch clients ──
// Each function turns a provider's recent items into a normalized ConnectorItem
// that the generic sync pipeline can raw-store, summarize and distill from.
// All are read-only calls. Capped via `maxItems` in the registry / CLI flags.

export interface ConnectorItem {
  id: string;
  title: string;
  body: string;
  when: string | null;
  who: string | null;
  url: string | null;
  meta: Record<string, string>;
}

async function jsonFetch(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as unknown;
}

function bearer(auth: RequestInit, token: string): RequestInit & { headers: Record<string, string> } {
  return { ...auth, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(auth.headers as Record<string, string>) } };
}

function iso(ts?: string | number | null): string | null {
  if (ts == null) return null;
  const ms = typeof ts === 'string' ? (isNaN(Date.parse(ts)) ? Number(ts) : Date.parse(ts)) : ts;
  if (!isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

// ── Google Calendar ──

interface GcalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  htmlLink?: string;
  attendees?: { email: string }[];
}

export async function fetchCalendarRecent(token: string, maxItems: number): Promise<ConnectorItem[]> {
  const params = new URLSearchParams({
    maxResults: String(maxItems),
    orderBy: 'updated',
    singleEvents: 'true',
    timeMin: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    fields: 'items(id,summary,description,location,status,start,end,attendees,htmlLink)',
  });
  const data = (await jsonFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, bearer({}, token))) as {
    items?: GcalEvent[];
  };
  return (data.items ?? []).map((e) => ({
    id: e.id,
    title: e.summary?.trim() || '(Untitled event)',
    body: [e.description ?? '', e.location ? `Location: ${e.location}` : ''].filter(Boolean).join('\n'),
    when: iso(e.start?.dateTime ?? e.start?.date),
    who: (e.attendees ?? []).map((a) => a.email).filter(Boolean).join(', '),
    url: e.htmlLink ?? null,
    meta: { kind: 'event', status: e.status ?? '' },
  }));
}

// ── Google Drive ──

interface DriveFile {
  id: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
  exportLinks?: Record<string, string>;
}

const DOC_EXPORT = new Map<string, string>([
  ['application/vnd.google-apps.document', 'text/plain'],
  ['application/vnd.google-apps.slides', 'text/plain'],
  ['application/vnd.google-apps.sheet', 'text/csv'],
]);

export async function fetchDriveRecent(token: string, maxItems: number): Promise<ConnectorItem[]> {
  const params = new URLSearchParams({
    pageSize: String(maxItems),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size,exportLinks)',
  });
  const data = (await jsonFetch(`https://www.googleapis.com/drive/v3/files?${params}`, bearer({}, token))) as { files?: DriveFile[] };

  const out: ConnectorItem[] = [];
  for (const f of data.files ?? []) {
    let excerpt = '';
    const exportMime = f.mimeType ? DOC_EXPORT.get(f.mimeType) : undefined;
    if (f.exportLinks && exportMime && f.exportLinks[exportMime]) {
      try {
        const res = await fetch(f.exportLinks[exportMime], bearer({}, token));
        if (res.ok) excerpt = (await res.text()).slice(0, 4000);
      } catch {
        // Doc export is best-effort; keep metadata-only.
      }
    }
    out.push({
      id: f.id,
      title: f.name?.trim() || '(Untitled)',
      body: excerpt || f.mimeType || '',
      when: iso(f.modifiedTime),
      who: null,
      url: f.webViewLink ?? null,
      meta: { kind: 'file', mimeType: f.mimeType ?? '', size: f.size ?? '' },
    });
  }
  return out;
}

// ── GitHub ──

interface GhIssue {
  id: number;
  title?: string;
  body?: string;
  state?: string;
  html_url?: string;
  updated_at?: string;
  pull_request?: unknown;
  number?: number;
  user?: { login?: string };
  repository_url?: string;
}

export async function fetchGithubRecent(token: string, maxItems: number): Promise<ConnectorItem[]> {
  const params = new URLSearchParams({ state: 'all', sort: 'updated', per_page: String(maxItems), filter: 'all' });
  const data = (await jsonFetch(`https://api.github.com/user/issues?${params}`, bearer({ headers: { 'User-Agent': 'timps-connector' } }, token))) as GhIssue[];
  return data.map((i) => ({
    id: `gh-${i.id}`,
    title: i.title?.trim() ?? '(Untitled)',
    body: (i.body ?? '').slice(0, 4000),
    when: iso(i.updated_at),
    who: i.user?.login ?? null,
    url: i.html_url ?? null,
    meta: {
      kind: i.pull_request ? 'pull_request' : 'issue',
      state: i.state ?? '',
      number: String(i.number ?? i.id),
      repo: (i.repository_url ?? '').split('/repos/')[1] ?? '',
    },
  }));
}

// ── Notion ──

interface NotionRichText {
  plain_text?: string;
}

interface NotionBlock {
  type?: string;
  [k: string]: any;
}

function notionClient(token: string): (url: string, init?: RequestInit) => Promise<unknown> {
  return (url, init) =>
    jsonFetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...((init?.headers as Record<string, string>) ?? {}),
      },
    });
}

function notionText(rt: NotionRichText[] | undefined): string {
  return (rt ?? []).map((t) => t.plain_text ?? '').join('');
}

async function notionPageExcerpt(client: (url: string, init?: RequestInit) => Promise<unknown>, blockId: string): Promise<string> {
  try {
    const data = (await client(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=8`)) as { results?: NotionBlock[] };
    const bits: string[] = [];
    for (const b of data.results ?? []) {
      const type = b.type;
      if (type === 'paragraph') bits.push(notionText(b.paragraph?.rich_text));
      else if (type === 'heading_1' || type === 'heading_2' || type === 'heading_3')
        bits.push(notionText(b[type]?.rich_text));
      else if (type === 'bulleted_list_item' || type === 'numbered_list_item' || type === 'to_do')
        bits.push(notionText(b[type]?.rich_text));
      if (bits.join('\n').length > 800) break;
    }
    return bits.filter(Boolean).join('\n').slice(0, 1000);
  } catch {
    return '';
  }
}

function notionPageTitle(result: any): string {
  if (result.object === 'page' && result.properties) {
    for (const key of Object.keys(result.properties)) {
      const prop = result.properties[key];
      const text = notionText(prop?.title ?? prop?.rich_text);
      if (text) return text;
    }
  }
  const text = notionText(result.title?.title);
  if (text) return text;
  return '(Untitled page)';
}

export async function fetchNotionRecent(token: string, maxItems: number): Promise<ConnectorItem[]> {
  const client = notionClient(token);
  const data = (await client('https://api.notion.com/v1/search', {
    method: 'POST',
    body: JSON.stringify({
      page_size: maxItems,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      filter: { value: 'page', property: 'object' },
    }),
  })) as { results?: any[] };

  const out: ConnectorItem[] = [];
  for (const page of data.results ?? []) {
    const title = notionPageTitle(page);
    const excerpt = await notionPageExcerpt(client, page.id);
    out.push({
      id: `nt-${page.id}`,
      title,
      body: excerpt,
      when: iso(page.last_edited_time),
      who: page.created_by?.name ?? null,
      url: page.url ?? null,
      meta: { kind: 'page' },
    });
  }
  return out;
}

// ── Slack ──

interface SlackChannel {
  id?: string;
  name?: string;
}

interface SlackMessage {
  ts?: string;
  user?: string;
  text?: string;
  subtype?: string;
}

export async function fetchSlackRecent(token: string, maxItems: number): Promise<ConnectorItem[]> {
  const api = (path: string, extra?: URLSearchParams) =>
    jsonFetch(`https://slack.com/api/${path}?${(extra ?? new URLSearchParams()).toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  const channelsData = (await api('conversations.list', new URLSearchParams({ types: 'public_channel,private_channel', exclude_archived: 'true', limit: '50' }))) as {
    ok?: boolean;
    channels?: SlackChannel[];
  };
  if (channelsData.ok === false) throw new Error('Slack conversations.list failed');

  const channels = (channelsData.channels ?? []).slice(0, 10);
  const perChannel = Math.max(1, Math.ceil(maxItems / Math.max(channels.length, 1)));

  const out: ConnectorItem[] = [];
  for (const ch of channels) {
    if (!ch.id) continue;
    const hist = (await api('conversations.history', new URLSearchParams({ channel: ch.id, limit: String(perChannel) }))) as {
      ok?: boolean;
      messages?: SlackMessage[];
    };
    for (const m of hist.messages ?? []) {
      if (!m.ts || !m.text) continue;
      out.push({
        id: `sl-${ch.id}-${m.ts.replace('.', '')}`,
        title: m.text.slice(0, 120),
        body: m.text,
        when: iso(Number(m.ts) * 1000),
        who: m.user ?? null,
        url: null,
        meta: { kind: 'message', channel: ch.name ?? ch.id },
      });
      if (out.length >= maxItems) return out;
    }
  }
  return out;
}

// ── Linear ──

interface LinearIssue {
  id: string;
  title?: string;
  description?: string;
  updatedAt?: string;
  url?: string;
  identifier?: string;
  state?: { name?: string };
  project?: { name?: string } | null;
}

export async function fetchLinearRecent(token: string, maxItems: number): Promise<ConnectorItem[]> {
  const query = `{ viewer { id } issues(first: ${maxItems}, orderBy: updatedAt) { nodes { id title description updatedAt url identifier state { name } project { name } } } }`;
  const data = (await jsonFetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })) as { data?: { issues?: { nodes?: LinearIssue[] } } };

  return (data.data?.issues?.nodes ?? []).map((i) => ({
    id: i.id,
    title: i.title?.trim() ?? '(Untitled issue)',
    body: (i.description ?? '').slice(0, 4000),
    when: iso(i.updatedAt),
    who: null,
    url: i.url ?? null,
    meta: {
      kind: 'issue',
      identifier: i.identifier ?? '',
      state: i.state?.name ?? '',
      project: i.project?.name ?? '',
    },
  }));
}

// ── Microsoft 365 ──

interface MsMail {
  id: string;
  subject?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  bodyPreview?: string;
  receivedDateTime?: string;
  webLink?: string;
}

interface MsEvent {
  id: string;
  subject?: string;
  body?: { preview?: string };
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  webLink?: string;
}

export async function fetchMs365Recent(token: string, maxItems: number): Promise<ConnectorItem[]> {
  const mailN = Math.ceil((maxItems * 3) / 5);
  const eventN = maxItems - mailN;
  const out: ConnectorItem[] = [];

  try {
    const mparams = new URLSearchParams({
      $top: String(mailN),
      $select: 'id,subject,from,bodyPreview,receivedDateTime,webLink',
      $orderby: 'receivedDateTime desc',
    });
    const mdata = (await jsonFetch(`https://graph.microsoft.com/v1.0/me/messages?${mparams}`, bearer({}, token))) as {
      value?: MsMail[];
    };
    for (const m of mdata.value ?? []) {
      const from = m.from?.emailAddress;
      out.push({
        id: `ms-mail-${m.id}`,
        title: m.subject?.trim() || '(No subject)',
        body: m.bodyPreview ?? '',
        when: iso(m.receivedDateTime),
        who: from ? `${from.name ?? ''} <${from.address ?? ''}>`.trim() : null,
        url: m.webLink ?? null,
        meta: { kind: 'mail' },
      });
    }
  } catch {
    // Mail scope not granted — skip mail, calendar events may still work.
  }

  try {
    const eparams = new URLSearchParams({
      $top: String(eventN),
      $select: 'id,subject,body,start,end,webLink',
      $orderby: 'start/dateTime desc',
    });
    const edata = (await jsonFetch(`https://graph.microsoft.com/v1.0/me/events?${eparams}`, bearer({}, token))) as {
      value?: MsEvent[];
    };
    for (const ev of edata.value ?? []) {
      out.push({
        id: `ms-ev-${ev.id}`,
        title: ev.subject?.trim() || '(Untitled event)',
        body: ev.body?.preview ?? '',
        when: iso(ev.start?.dateTime),
        who: null,
        url: ev.webLink ?? null,
        meta: { kind: 'event' },
      });
    }
  } catch {
    // Calendar scope not granted — mail-only is fine.
  }

  return out.slice(0, maxItems);
}