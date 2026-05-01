// TIMPS Project Context (CLAUDE.md style)
// Project-level persistent context

import * as fs from 'node:fs';
import * as path from 'node:path';

const PROJECT_CONTEXT_FILE = 'CLAUDE.md';
const TIMPS_CONTEXT_FILE = '.claude.md';

export interface ProjectContext {
  file: string;
  rules: RuleFile[];
}

export interface RuleFile {
  name: string;
  content: string;
  path: string;
}

export class ProjectContextManager {
  private cwd: string;
  
  constructor(cwd: string) {
    this.cwd = cwd;
  }
  
  // Load project context
  load(): string {
    let content = '';
    
    // Load CLAUDE.md (root level)
    const mainPath = path.join(this.cwd, PROJECT_CONTEXT_FILE);
    if (fs.existsSync(mainPath)) {
      content += fs.readFileSync(mainPath, 'utf-8') + '\n\n';
    }
    
    // Load .claude/rules/*.md
    const rulesDir = path.join(this.cwd, '.claude', 'rules');
    if (fs.existsSync(rulesDir)) {
      const files = fs.readdirSync(rulesDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          content += '\n--- ' + file + '\n\n';
          content += fs.readFileSync(path.join(rulesDir, file), 'utf-8');
        }
      }
    }
    
    return content;
  }
  
  // Save project context
  save(content: string): void {
    const mainPath = path.join(this.cwd, PROJECT_CONTEXT_FILE);
    fs.writeFileSync(mainPath, content, 'utf-8');
  }
  
  // Check if context exists
  exists(): boolean {
    return fs.existsSync(path.join(this.cwd, PROJECT_CONTEXT_FILE));
  }
  
  // Add rule file
  addRule(name: string, content: string): void {
    const rulesDir = path.join(this.cwd, '.claude', 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, `${name}.md`), content, 'utf-8');
  }
  
  // List rule files
  listRules(): string[] {
    const rulesDir = path.join(this.cwd, '.claude', 'rules');
    if (!fs.existsSync(rulesDir)) return [];
    
    return fs.readdirSync(rulesDir).filter(f => f.endsWith('.md'));
  }
  
  // Get rule content
  getRule(name: string): string | null {
    const rulePath = path.join(this.cwd, '.claude', 'rules', name);
    if (!fs.existsSync(rulePath)) return null;
    
    return fs.readFileSync(rulePath, 'utf-8');
  }
  
  // Delete rule
  deleteRule(name: string): boolean {
    const rulePath = path.join(this.cwd, '.claude', 'rules', name);
    if (!fs.existsSync(rulePath)) return false;
    
    fs.unlinkSync(rulePath);
    return true;
  }
}

// Load project context for agent prompt
export function getProjectContext(cwd: string): string {
  const manager = new ProjectContextManager(cwd);
  return manager.load();
}