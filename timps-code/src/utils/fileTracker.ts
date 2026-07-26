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

// Directories to always skip (large / generated / irrelevant)
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'target',
  'coverage', '.next', '__pycache__', '.cache', '.turbo',
]);

// Max file size to track (1MB)
const MAX_FILE_SIZE = 1024 * 1024;

// Extensions to skip (binary / generated)
const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.mp3', '.mp4', '.wav', '.avi', '.mov',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.eot',
  '.exe', '.dll', '.so', '.dylib',
  '.wasm', '.node',
  '.lock', '.sum',
]);

export class FileTracker {
  private changes: FileChange[] = [];
  private snapshot: Map<string, { size: number; mtime: number }> = new Map();
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.loadInitialState();
  }

  private loadInitialState(): void {
    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return; // unreadable directory
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) {
            scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SKIP_EXTENSIONS.has(ext)) continue;

          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > MAX_FILE_SIZE) continue;
            this.snapshot.set(fullPath, { size: stat.size, mtime: stat.mtimeMs });
          } catch {
            // unreadable file — skip
          }
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
    // Read original from disk lazily (not held in memory)
    let original: string | undefined;
    const snap = this.snapshot.get(filePath);
    if (snap) {
      try {
        original = fs.readFileSync(filePath, 'utf-8');
        // We don't have the original content anymore — report snapshot metadata
        return `File: ${filePath}\n(last snapshot: ${snap.size} bytes, ${new Date(snap.mtime).toLocaleString()})\n`;
      } catch {
        // File may have been deleted
      }
    }

    if (!snap) {
      return `File: ${filePath}\n--- /dev/null\n+++ b/${filePath}\n@@ +0,0 @@\n`;
    }

    // File exists but wasn't snapshotted — read current
    let current: string;
    try {
      current = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return `File: ${filePath}\n(unreadable)\n`;
    }

    const originalLines = (original ?? '').split('\n');
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