// TIMPS Code — Resume Conversation Screen
// Terminal UI for resuming previous conversations

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

export interface ConversationEntry {
  id: string;
  title: string;
  date: string;
  messages: number;
  path: string;
}

export interface ResumeScreenOptions {
  onSelect: (entry: ConversationEntry) => void;
  onCancel: () => void;
}

export async function showResumeScreen(options: ResumeScreenOptions): Promise<void> {
  const { onSelect, onCancel } = options;

  const sessionsDir = path.join(process.env.HOME || '', '.timps', 'sessions');
  const entries: ConversationEntry[] = [];

  if (fs.existsSync(sessionsDir)) {
    try {
      const files = fs.readdirSync(sessionsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const fp = path.join(sessionsDir, file);
          try {
            const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
            entries.push({
              id: file.replace('.json', ''),
              title: data.title || file.replace('.json', ''),
              date: data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'unknown',
              messages: data.messages?.length || 0,
              path: fp,
            });
          } catch { /* skip invalid files */ }
        }
      }
    } catch { /* skip unreadable dir */ }
  }

  console.log('\n\x1b[1;36m╔══════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[1;36m║           Resume Previous Conversation                      ║\x1b[0m');
  console.log('\x1b[1;36m╚══════════════════════════════════════════════════════════════╝\x1b[0m\n');

  if (entries.length === 0) {
    console.log('\x1b[33mNo previous conversations found.\x1b[0m');
    console.log('Start a new conversation and it will be saved automatically.\n');
    console.log('Press \x1b[1mEnter\x1b[0m to start a new conversation, or \x1b[1mCtrl+C\x1b[0m to exit.\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => {
      rl.close();
      onCancel();
    });
    return;
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));

  console.log('\x1b[2m┌────┬─────────────────────────────────────┬──────────┬────────┐\x1b[0m');
  console.log('\x1b[2m│ No │ Title                               │ Date     │ Msgs   │\x1b[0m');
  console.log('\x1b[2m├────┼─────────────────────────────────────┼──────────┼────────┤\x1b[0m');

  entries.slice(0, 10).forEach((entry, i) => {
    const num = String(i + 1).padStart(3);
    const title = entry.title.slice(0, 35).padEnd(35);
    const date = entry.date.padEnd(10);
    const msgs = String(entry.messages).padStart(4);
    console.log(`\x1b[2m│\x1b[0m ${num} \x1b[2m│\x1b[0m ${title} \x1b[2m│\x1b[0m ${date} \x1b[2m│\x1b[0m${msgs} \x1b[2m│\x1b[0m`);
  });

  console.log('\x1b[2m└────┴─────────────────────────────────────┴──────────┴────────┘\x1b[0m');
  console.log('\n\x1b[1m[N]\x1b[0m New conversation  \x1b[1m[1-9]\x1b[0m Resume  \x1b[1m[Q]\x1b[0m Quit\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Select option: ', (answer) => {
    rl.close();

    const trimmed = answer.trim().toLowerCase();

    if (trimmed === 'n' || trimmed === '') {
      onCancel();
      return;
    }

    if (trimmed === 'q' || trimmed === 'quit') {
      process.exit(0);
    }

    const num = parseInt(trimmed, 10);
    if (num >= 1 && num <= entries.length && num <= 10) {
      onSelect(entries[num - 1]);
      return;
    }

    console.log('\x1b[31mInvalid selection.\x1b[0m');
    onCancel();
  });
}

export async function loadConversationMessages(sessionId: string): Promise<any[] | null> {
  try {
    const fp = path.join(process.env.HOME || '', '.timps', 'sessions', `${sessionId}.json`);
    if (!fs.existsSync(fp)) return null;

    const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    return data.messages || null;
  } catch {
    return null;
  }
}

export async function saveCurrentSession(messages: any[], title?: string): Promise<string> {
  const sessionsDir = path.join(process.env.HOME || '', '.timps', 'sessions');
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }

  const sessionId = `session_${Date.now()}`;
  const fp = path.join(sessionsDir, `${sessionId}.json`);

  const data = {
    id: sessionId,
    title: title || `Conversation ${new Date().toLocaleDateString()}`,
    createdAt: Date.now(),
    messages,
  };

  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
  return sessionId;
}

export async function listRecentSessions(limit = 10): Promise<ConversationEntry[]> {
  const sessionsDir = path.join(process.env.HOME || '', '.timps', 'sessions');
  const entries: ConversationEntry[] = [];

  if (!fs.existsSync(sessionsDir)) return entries;

  try {
    const files = fs.readdirSync(sessionsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const fp = path.join(sessionsDir, file);
        try {
          const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
          entries.push({
            id: file.replace('.json', ''),
            title: data.title || file.replace('.json', ''),
            date: data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'unknown',
            messages: data.messages?.length || 0,
            path: fp,
          });
        } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }

  return entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}