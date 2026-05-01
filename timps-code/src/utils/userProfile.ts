// TIMPS User Profiles
// Persistent user modeling and session management

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const PROFILES_DIR = path.join(os.homedir(), '.timps', 'profiles');

export interface UserProfile {
  id: string;
  name: string;
  
  // Preferences
  defaultProvider: string;
  defaultModel: string;
  trustLevel: string;
  preferredLanguage: string;
  
  // Project history
  projects: string[];  // Project directories
  
  // Learned preferences
  preferredTools: string[];
  avoidedTools: string[];
  communicationStyle: 'concise' | 'detailed' | 'mixed';
  
  // Session history
  totalSessions: number;
  totalTokens: number;
  lastSession: number;
}

export interface Session {
  id: string;
  profileId: string;
  startTime: number;
  endTime: number | null;
  turns: number;
  provider: string;
  model: string;
  workingDir: string;
  summary: string;
}

// List profiles
export function listProfiles(): string[] {
  try {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
    const files = fs.readdirSync(PROFILES_DIR);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

// Load a profile
export function loadUserProfile(name: string): UserProfile | null {
  const file = path.join(PROFILES_DIR, name + '.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

// Save a profile
export function saveUserProfile(profile: UserProfile): void {
  fs.mkdirSync(PROFILES_DIR, { recursive: true });
  const file = path.join(PROFILES_DIR, profile.name + '.json');
  fs.writeFileSync(file, JSON.stringify(profile, null, 2), 'utf-8');
}

// Create default profile
export function createProfile(name: string): UserProfile {
  const profile: UserProfile = {
    id: name,
    name,
    defaultProvider: 'ollama',
    defaultModel: 'qwen2.5-coder:latest',
    trustLevel: 'normal',
    preferredLanguage: 'en',
    projects: [],
    preferredTools: [],
    avoidedTools: [],
    communicationStyle: 'mixed',
    totalSessions: 0,
    totalTokens: 0,
    lastSession: Date.now(),
  };
  
  saveUserProfile(profile);
  return profile;
}

// Update profile after session
export function updateProfileAfterSession(
  name: string,
  turns: number,
  tokens: number,
  workingDir: string
): void {
  const profile = loadUserProfile(name);
  if (!profile) return;
  
  profile.totalSessions++;
  profile.totalTokens += tokens;
  profile.lastSession = Date.now();
  
  if (!profile.projects.includes(workingDir)) {
    profile.projects.push(workingDir);
    if (profile.projects.length > 50) profile.projects.shift();
  }
  
  saveUserProfile(profile);
}

// Track tool preference
export function trackToolPreference(name: string, tool: string, liked: boolean): void {
  const profile = loadUserProfile(name);
  if (!profile) return;
  
  if (liked) {
    if (!profile.preferredTools.includes(tool)) {
      profile.preferredTools.push(tool);
    }
    const idx = profile.avoidedTools.indexOf(tool);
    if (idx !== -1) profile.avoidedTools.splice(idx, 1);
  } else {
    if (!profile.avoidedTools.includes(tool)) {
      profile.avoidedTools.push(tool);
    }
    const idx = profile.preferredTools.indexOf(tool);
    if (idx !== -1) profile.preferredTools.splice(idx, 1);
  }
  
  saveUserProfile(profile);
}

// Sessions
export const SESSIONS_FILE = path.join(PROFILES_DIR, 'sessions.jsonl');

export function saveSession(session: Session): void {
  fs.mkdirSync(PROFILES_DIR, { recursive: true });
  fs.appendFileSync(SESSIONS_FILE, JSON.stringify(session) + '\n', 'utf-8');
}

export function loadRecentSessions(count = 10): Session[] {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return [];
    const lines = fs.readFileSync(SESSIONS_FILE, 'utf-8').trim().split('\n');
    return lines.slice(-count).map(l => JSON.parse(l)).filter(Boolean);
  } catch {
    return [];
  }
}

// Search sessions with FTS5-like text search
export function searchSessions(query: string, limit = 10): Session[] {
  const sessions = loadRecentSessions(100);
  const q = query.toLowerCase();
  
  return sessions
    .map(s => {
      const summaryLower = s.summary.toLowerCase();
      const score = q.split(/\s+/).reduce((acc, w) => acc + (summaryLower.includes(w) ? 1 : 0), 0);
      return { session: s, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.session);
}

// Initialize memory directory
export function initializeMemory(): void {
  const dirs = [
    path.join(os.homedir(), '.timps'),
    path.join(os.homedir(), '.timps', 'config'),
    path.join(os.homedir(), '.timps', 'memory'),
    path.join(os.homedir(), '.timps', 'skills'),
    path.join(os.homedir(), '.timps', 'history'),
    path.join(os.homedir(), '.timps', 'logs'),
    path.join(os.homedir(), '.timps', 'profiles'),
    path.join(os.homedir(), '.timps', 'cron'),
    path.join(os.homedir(), '.timps', 'gateway'),
    path.join(os.homedir(), '.timps', 'mcp'),
  ];
  
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}