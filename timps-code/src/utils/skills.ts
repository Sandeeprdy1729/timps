// ── TIMPS Code — SkillGalaxy Integration ──
// Fetch and apply skills from https://skill-galaxy.vercel.app
// Skills are .md instruction files that enhance the agent's expertise

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { t, icons } from '../config/theme.js';

const SKILLS_DIR = path.join(os.homedir(), '.timps', 'skills');
const SKILL_CACHE_FILE = path.join(SKILLS_DIR, '_cache.json');
const SKILL_GALAXY_URL = 'https://skill-galaxy.vercel.app';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty?: string;
  content?: string; // full markdown body (loaded on demand)
  version?: string;
}

interface SkillCache {
  timestamp: number;
  categories: string[];
  skills: Skill[];
}

// ═══════════════════════════════════════
// Skill storage
// ═══════════════════════════════════════

function ensureDir(): void {
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

function loadCache(): SkillCache | null {
  try {
    if (fs.existsSync(SKILL_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SKILL_CACHE_FILE, 'utf-8')) as SkillCache;
      if (Date.now() - data.timestamp < CACHE_TTL_MS) return data;
    }
  } catch { /* ignore */ }
  return null;
}

function saveCache(cache: SkillCache): void {
  ensureDir();
  fs.writeFileSync(SKILL_CACHE_FILE, JSON.stringify(cache), 'utf-8');
}

// ═══════════════════════════════════════
// Installed skills (local .md files)
// ═══════════════════════════════════════

export function getInstalledSkills(): Skill[] {
  ensureDir();
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
  return files.map(f => {
    const content = fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8');
    const meta = parseFrontmatter(content);
    return {
      id: f.replace('.md', ''),
      name: meta.name || f.replace('.md', ''),
      description: meta.description || '',
      category: meta.category || 'general',
      difficulty: meta.difficulty,
      version: meta.version,
      content,
    };
  });
}

export function installSkill(skill: Skill): void {
  ensureDir();
  const filename = `${skill.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
  const filepath = path.join(SKILLS_DIR, filename);
  fs.writeFileSync(filepath, skill.content || `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n`, 'utf-8');
}

export function uninstallSkill(skillId: string): boolean {
  const filename = `${skillId.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
  const filepath = path.join(SKILLS_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════
// SkillGalaxy API — search & fetch
// ═══════════════════════════════════════

export async function searchSkills(query: string, category?: string): Promise<Skill[]> {
  // Try local cache first
  const cache = loadCache();
  if (cache && cache.skills.length > 0) {
    return filterSkills(cache.skills, query, category);
  }

  // Fetch from SkillGalaxy
  try {
    const params = new URLSearchParams({ q: query, format: 'json' });
    if (category) params.set('category', category);

    const res = await fetch(`${SKILL_GALLERY_API}/api/skills?${params}`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      // Fallback to local installed skills
      return filterSkills(getInstalledSkills(), query, category);
    }

    const data = await res.json() as { skills?: Skill[] };
    const skills = data.skills || [];

    // Cache results
    saveCache({ timestamp: Date.now(), categories: [], skills });
    return skills.slice(0, 20);
  } catch {
    // Offline — search installed skills only
    return filterSkills(getInstalledSkills(), query, category);
  }
}

const SKILL_GALLERY_API = SKILL_GALAXY_URL;

export async function fetchSkillContent(skillId: string): Promise<string | null> {
  // Check if installed locally first
  const localPath = path.join(SKILLS_DIR, `${skillId.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`);
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath, 'utf-8');
  }

  try {
    const res = await fetch(`${SKILL_GALLERY_API}/api/skills/${encodeURIComponent(skillId)}`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json() as { content?: string; body?: string };
    return data.content || data.body || null;
  } catch {
    return null;
  }
}

export async function listCategories(): Promise<string[]> {
  const defaults = [
    'AI & ML', 'Cybersecurity', 'Data Engineering', 'Cloud & Infra',
    'Development', 'Writing', 'Business', 'Design & Education',
    'Product & Strategy', 'Creative Technology', 'Blockchain & Web3',
    'Robotics & Automation', 'Climate Tech', 'Quantum Computing',
    'Computational Biology', 'Spatial Computing',
  ];

  try {
    const res = await fetch(`${SKILL_GALLERY_API}/api/categories`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json() as { categories?: string[] };
      return data.categories || defaults;
    }
  } catch { /* fallback */ }
  return defaults;
}

// ═══════════════════════════════════════
// Build context injection from installed skills
// ═══════════════════════════════════════

export function getSkillContext(): string {
  const installed = getInstalledSkills();
  if (installed.length === 0) return '';

  const parts = ['## Active Skills (from SkillGalaxy)'];
  for (const skill of installed) {
    // Strip frontmatter, keep instruction body
    const body = stripFrontmatter(skill.content || '');
    if (body.trim()) {
      parts.push(`### ${skill.name}\n${body.slice(0, 2000)}`);
    }
  }
  return parts.join('\n\n');
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function filterSkills(skills: Skill[], query: string, category?: string): Skill[] {
  const q = query.toLowerCase();
  return skills.filter(s => {
    const matchQuery = !q || s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q);
    const matchCat = !category || s.category.toLowerCase() === category.toLowerCase();
    return matchQuery && matchCat;
  });
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      meta[key.trim()] = rest.join(':').trim();
    }
  }
  return meta;
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
}
