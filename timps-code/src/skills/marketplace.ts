/**
 * TIMPS Skills Marketplace
 *
 * Manages community skills: list, search, install from the bundled registry.
 * Skills are installed to ~/.timps/skills/<name>.md and can be used by the agent.
 *
 * Registry lives at src/skills/registry.json (ships with the package).
 * For future: hot-reload from https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/timps-code/src/skills/registry.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createRequire } from 'node:module';

const SKILLS_DIR = path.join(os.homedir(), '.timps', 'skills');
const REGISTRY_PATH = new URL('./registry.json', import.meta.url);

// ── Types ────────────────────────────────────────────────────────────────────

export interface RegistrySkill {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  version: string;
  content: string;
}

export interface SkillRegistry {
  version: string;
  updated: string;
  skills: RegistrySkill[];
}

// ── Registry access ──────────────────────────────────────────────────────────

function loadRegistry(): SkillRegistry {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
  return JSON.parse(raw) as SkillRegistry;
}

// ── Installed skill helpers ───────────────────────────────────────────────────

export function ensureSkillsDir(): void {
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

export function listInstalledSkills(): string[] {
  ensureSkillsDir();
  return fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
}

export function isInstalled(skillId: string): boolean {
  return fs.existsSync(path.join(SKILLS_DIR, `${skillId}.md`));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * List all skills in the registry, grouped by category.
 * Marks installed skills with [installed].
 */
export function listSkills(): { registry: SkillRegistry; installed: string[] } {
  const registry = loadRegistry();
  const installed = listInstalledSkills();
  return { registry, installed };
}

/**
 * Search skills by keyword — matches against name, description, and tags.
 */
export function searchSkills(query: string): RegistrySkill[] {
  const { skills } = loadRegistry();
  const q = query.toLowerCase();
  return skills.filter(s =>
    s.id.includes(q) ||
    s.name.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.tags.some(t => t.includes(q)) ||
    s.category.includes(q)
  );
}

/**
 * Install a skill from the registry to ~/.timps/skills/<id>.md
 * Returns the installed skill or null if not found.
 */
export function installSkill(skillId: string): { skill: RegistrySkill; alreadyInstalled: boolean } | null {
  const { skills } = loadRegistry();
  const skill = skills.find(s => s.id === skillId);
  if (!skill) return null;

  const alreadyInstalled = isInstalled(skillId);
  ensureSkillsDir();
  fs.writeFileSync(path.join(SKILLS_DIR, `${skillId}.md`), skill.content, 'utf-8');
  return { skill, alreadyInstalled };
}

/**
 * Load all installed skill contents as a concatenated context string.
 * Used by the agent to inject active skills into its system prompt.
 */
export function loadInstalledSkillsContent(): string {
  ensureSkillsDir();
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) return '';
  return files
    .map(f => fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8'))
    .join('\n\n---\n\n');
}

/**
 * Get the content of a single installed skill by id.
 */
export function getSkillContent(skillId: string): string | null {
  const file = path.join(SKILLS_DIR, `${skillId}.md`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf-8');
}
