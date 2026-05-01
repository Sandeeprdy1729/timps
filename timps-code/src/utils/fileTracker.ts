// TIMPS File Change Tracking
// Track and visualize file changes during session (like OpenCode)

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted';
  timestamp: number;
  size?: number;
  linesAdded?: number;
  linesRemoved?: number;
}

export class FileTracker {
  private changes: FileChange[] = [];
  private originalContent: Map<string, string> = new Map();
  private cwd: string;
  
  constructor(cwd: string) {
    this.cwd = cwd;
    this.loadInitialState();
  }
  
  private loadInitialState(): void {
    // Snapshot current files
    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile()) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          this.originalContent.set(fullPath, content);
        }
      }
    };
    
    scanDir(this.cwd);
  }
  
  // Track a change
  track(change: Omit<FileChange, 'timestamp'>): void {
    const fullChange: FileChange = {
      ...change,
      timestamp: Date.now(),
    };
    
    this.changes.push(fullChange);
    
    // Keep only last 100 changes
    if (this.changes.length > 100) {
      this.changes.shift();
    }
  }
  
  // Get changes
  getChanges(): FileChange[] {
    return [...this.changes];
  }
  
  // Get changes by type
  getChangesByType(type: FileChange['type']): FileChange[] {
    return this.changes.filter(c => c.type === type);
  }
  
  // Get summary
  getSummary(): { created: number; modified: number; deleted: number } {
    return {
      created: this.changes.filter(c => c.type === 'created').length,
      modified: this.changes.filter(c => c.type === 'modified').length,
      deleted: this.changes.filter(c => c.type === 'deleted').length,
    };
  }
  
  // Generate diff (git-style)
  diff(filePath: string): string {
    const original = this.originalContent.get(filePath);
    if (!original) {
      return `File: ${filePath}\n--- /dev/null\n+++ b/${filePath}\n@@ +0,0 @@\n`;
    }
    
    const current = fs.readFileSync(filePath, 'utf-8');
    
    // Simple line-by-line diff
    const originalLines = original.split('\n');
    const currentLines = current.split('\n');
    
    let diff = `File: ${filePath}\n`;
    diff += `--- a/${filePath}\n`;
    diff += `+++ b/${filePath}\n`;
    
    const maxLines = Math.max(originalLines.length, currentLines.length);
    let line = 0;
    
    for (line = 0; line < maxLines; line++) {
      const oldLine = originalLines[line];
      const newLine = currentLines[line];
      
      if (oldLine === newLine) continue;
      
      if (oldLine === undefined) {
        diff += `@@ +${line + 1},0 @@\n+${newLine}\n`;
      } else if (newLine === undefined) {
        diff += `@@ -${line + 1},0 @@\n-${oldLine}\n`;
      } else {
        diff += `@@ -${line + 1},1 @@\n-${oldLine}\n+${newLine}\n`;
      }
    }
    
    return diff;
  }
  
  // Clear changes
  clear(): void {
    this.changes = [];
  }
  
  // Export for display
  toMarkdown(): string {
    if (this.changes.length === 0) return 'No changes';
    
    let md = '# File Changes\n\n';
    
    for (const change of this.changes) {
      const icon = { created: '+', modified: '~', deleted: '-' }[change.type];
      const time = new Date(change.timestamp).toLocaleTimeString();
      
      md += `- ${icon} ${change.path} (${change.type}) ${time}\n`;
    }
    
    return md;
  }
}

// Session file tracker
export class SessionTracker {
  private sessions: Map<string, FileTracker> = new Map();
  
  getOrCreate(cwd: string): FileTracker {
    const existing = this.sessions.get(cwd);
    if (existing) return existing;
    
    const tracker = new FileTracker(cwd);
    this.sessions.set(cwd, tracker);
    return tracker;
  }
  
  clear(): void {
    this.sessions.clear();
  }
}

export const sessionTracker = new SessionTracker();