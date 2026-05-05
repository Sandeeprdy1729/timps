// TIMPS Skills System
// Agent-created procedural memory — skills auto-improve during use

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generateId } from './utils.js';

export interface Skill {
  id: string;
  name: string;
  description: string;
  trigger: string;
  prompt: string;
  content?: string;
  category?: string;
  tools: string[];
  examples: string[];
  version: number;
  createdAt: number;
  lastUsed: number;
  useCount: number;
  selfImprove: boolean;
}

export interface SkillManifest {
  skills: Skill[];
  version: string;
  createdAt: number;
}

const SKILLS_DIR = path.join(os.homedir(), '.timps', 'skills');
const MANIFEST_FILE = path.join(SKILLS_DIR, 'manifest.json');

export class SkillsEngine {
  private manifest: SkillManifest;
  private loaded: Map<string, Skill> = new Map();

  constructor() {
    this.manifest = this.loadManifest();
  }

  private loadManifest(): SkillManifest {
    try {
      if (fs.existsSync(MANIFEST_FILE)) {
        return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
      }
    } catch { /* ignore */ }
    return { skills: [], version: '1.0', createdAt: Date.now() };
  }

  private saveManifest(): void {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(this.manifest, null, 2), 'utf-8');
  }

  listSkills(): Skill[] {
    return this.manifest.skills.sort((a, b) => b.useCount - a.useCount);
  }

  findSkill(query: string): Skill | null {
    const q = query.toLowerCase();
    return this.manifest.skills.find(s => 
      s.name.toLowerCase().includes(q) || 
      s.trigger.toLowerCase().includes(q)
    ) || null;
  }

  registerSkill(skill: Omit<Skill, 'id' | 'version' | 'createdAt' | 'lastUsed' | 'useCount'>): Skill {
    const existing = this.findSkill(skill.name);
    if (existing) {
      existing.useCount++;
      existing.lastUsed = Date.now();
      this.saveManifest();
      return existing;
    }

    const newSkill: Skill = {
      ...skill,
      id: generateId('skill'),
      version: 1,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      useCount: 1,
    };

    this.manifest.skills.push(newSkill);
    this.loaded.set(newSkill.id, newSkill);
    this.saveManifest();
    
    return newSkill;
  }

  useSkill(skillId: string): string | null {
    const skill = this.manifest.skills.find(s => s.id === skillId);
    if (!skill) return null;
    
    skill.useCount++;
    skill.lastUsed = Date.now();
    this.saveManifest();
    
    return skill.prompt;
  }

  improveSkill(skillId: string, improvedPrompt: string): boolean {
    const skill = this.manifest.skills.find(s => s.id === skillId);
    if (!skill) return false;

    skill.prompt = improvedPrompt;
    skill.version++;
    skill.lastUsed = Date.now();
    this.saveManifest();
    
    return true;
  }

  suggestSkills(task: string, limit = 3): Skill[] {
    const q = task.toLowerCase();
    const words = q.split(/\s+/);
    
    return this.manifest.skills
      .map(s => {
        const triggerLower = s.trigger.toLowerCase();
        const score = words.reduce((acc, w) => acc + (triggerLower.includes(w) ? 1 : 0), 0);
        return { skill: s, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.skill);
  }

  deleteSkill(skillId: string): boolean {
    const idx = this.manifest.skills.findIndex(s => s.id === skillId);
    if (idx === -1) return false;
    
    this.manifest.skills.splice(idx, 1);
    this.loaded.delete(skillId);
    this.saveManifest();
    
    return true;
  }

  exportSkill(skillId: string): string | null {
    const skill = this.manifest.skills.find(s => s.id === skillId);
    if (!skill) return null;
    
    return JSON.stringify({
      name: skill.name,
      description: skill.description,
      trigger: skill.trigger,
      prompt: skill.prompt,
      tools: skill.tools,
      examples: skill.examples,
    }, null, 2);
  }

  importSkill(json: string): Skill | null {
    try {
      const imported = JSON.parse(json);
      return this.registerSkill({
        name: imported.name,
        description: imported.description,
        trigger: imported.trigger,
        prompt: imported.prompt,
        tools: imported.tools || [],
        examples: imported.examples || [],
        selfImprove: imported.selfImprove ?? true,
      });
    } catch {
      return null;
    }
  }

  getStats(): { totalSkills: number; totalUses: number; selfImproving: number } {
    return {
      totalSkills: this.manifest.skills.length,
      totalUses: this.manifest.skills.reduce((a, s) => a + s.useCount, 0),
      selfImproving: this.manifest.skills.filter(s => s.selfImprove).length,
    };
  }
}

export const DEFAULT_SKILLS: Partial<Skill>[] = [
  {
    name: 'Code Review',
    description: 'Review code for bugs, security issues, and best practices',
    trigger: 'review code|review pr|check code',
    prompt: 'You are a code reviewer. Analyze the provided code for:\n1. Bugs and edge cases\n2. Security vulnerabilities\n3. Performance issues\n4. Code style violations\n\nProvide specific, actionable feedback.',
    tools: ['search_code', 'read_file'],
    examples: ['review src/utils.ts', 'review this PR'],
  },
  {
    name: 'Explain Error',
    description: 'Explain and fix programming errors',
    trigger: 'fix error|debug|error fix|what does this mean',
    prompt: 'You are a debugging assistant. When given an error:\n1. Explain what caused it in simple terms\n2. Show the exact fix\n3. Suggest how to prevent it in the future',
    tools: ['search_code', 'run_diagnostics'],
    examples: ['fix this error', 'debug TypeError'],
  },
  {
    name: 'Write Tests',
    description: 'Generate comprehensive tests',
    trigger: 'write tests|add tests|test',
    prompt: 'You are a test engineer. Write comprehensive tests that:\n1. Cover happy path and edge cases\n2. Use descriptive test names\n3. Follow project testing conventions\n4. Mock external dependencies',
    tools: ['find_files', 'read_file', 'bash'],
    examples: ['write tests for utils.ts', 'add tests'],
  },
  {
    name: 'Refactor',
    description: 'Refactor code for better quality',
    trigger: 'refactor|clean up|improve',
    prompt: 'You are a refactoring expert. When refactoring:\n1. Make small, incremental changes\n2. Preserve behavior exactly\n3. Add tests before large changes\n4. Run tests after each change',
    tools: ['search_code', 'read_file', 'bash'],
    examples: ['refactor this function', 'clean up legacy code'],
  },
];

// ── Convenience functions used by app.ts / renderer.ts ──

const _engine = new SkillsEngine();

export function getInstalledSkills(): Skill[] {
  return _engine.listSkills();
}

export function searchSkills(query: string): Promise<Skill[]> {
  return Promise.resolve(_engine.listSkills().filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.description.toLowerCase().includes(query.toLowerCase())
  ));
}

export function installSkill(skill: Omit<Skill, 'id' | 'version' | 'createdAt' | 'lastUsed' | 'useCount'>): Skill {
  return _engine.registerSkill(skill);
}

export function uninstallSkill(id: string): boolean {
  const all = _engine.listSkills();
  const before = all.length;
  // SkillsEngine stores to disk; remove by overwriting without that entry
  const idx = all.findIndex(s => s.id === id || s.name === id);
  if (idx === -1) return false;
  all.splice(idx, 1);
  return all.length < before;
}

export async function fetchSkillContent(query: string): Promise<string> {
  const skill = _engine.findSkill(query);
  return skill ? skill.prompt : '';
}

export function getSkillContext(task?: string): string {
  const skills = task ? _engine.listSkills().filter(s =>
    task.toLowerCase().includes(s.trigger.toLowerCase()) ||
    s.trigger.toLowerCase().includes(task.toLowerCase().slice(0, 20))
  ) : _engine.listSkills().slice(0, 3);
  if (skills.length === 0) return '';
  return 'Available skills:\n' + skills.map(s => `  • ${s.name}: ${s.description}`).join('\n');
}

export function initializeDefaultSkills(): void {
  const engine = new SkillsEngine();
  for (const skill of DEFAULT_SKILLS) {
    if (skill.name && !engine.findSkill(skill.name)) {
      engine.registerSkill({
        name: skill.name,
        description: skill.description || '',
        trigger: skill.trigger || '',
        prompt: skill.prompt || '',
        tools: skill.tools || [],
        examples: skill.examples || [],
        selfImprove: true,
      });
    }
  }
}