/**
 * TIMPS Memory View — VS Code TreeView showing live 3-layer memory
 *
 * Displays:
 *   🧠 Semantic Facts     (type + importance, sorted by importance desc)
 *   📖 Recent Sessions    (episodic memory, last 10)
 *   ⚡ Working Memory     (active files, current goal, discovered patterns)
 *
 * Refreshes on command or when memory files change (via fs.watch).
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TIMPsMemory, type EpisodicMemory } from './memory';

// ── Tree Item ─────────────────────────────────────────────────────────────────

type MemoryNodeKind =
  | 'section'
  | 'semantic-entry'
  | 'episode'
  | 'working-file'
  | 'working-goal'
  | 'working-pattern'
  | 'empty';

export class MemoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly kind: MemoryNodeKind,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly detail?: string,
  ) {
    super(label, collapsibleState);
    this.contextValue = kind;
    this.tooltip = detail ?? label;
    this._setIcon();
    if (detail && kind !== 'section') {
      this.description = detail.length > 60 ? detail.slice(0, 57) + '…' : detail;
    }
  }

  private _setIcon(): void {
    const icons: Record<MemoryNodeKind, vscode.ThemeIcon> = {
      section:          new vscode.ThemeIcon('database'),
      'semantic-entry': new vscode.ThemeIcon('symbol-key'),
      episode:          new vscode.ThemeIcon('history'),
      'working-file':   new vscode.ThemeIcon('file-code'),
      'working-goal':   new vscode.ThemeIcon('target'),
      'working-pattern':new vscode.ThemeIcon('lightbulb'),
      empty:            new vscode.ThemeIcon('info'),
    };
    this.iconPath = icons[this.kind];
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class MemoryViewProvider implements vscode.TreeDataProvider<MemoryTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MemoryTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _memory: TIMPsMemory | null = null;
  private _storageRoot: string;
  private _watchers: fs.FSWatcher[] = [];

  constructor(storageRoot: string) {
    this._storageRoot = storageRoot;
    this._initMemory();
    this._watchFiles();
  }

  private _initMemory(): void {
    try {
      this._memory = new TIMPsMemory(this._storageRoot);
      this._memory.init().catch(() => {});
    } catch {
      this._memory = null;
    }
  }

  private _watchFiles(): void {
    const memDir = path.join(this._storageRoot, 'timps-memory');
    if (!fs.existsSync(memDir)) return;
    const watch = (file: string) => {
      if (!fs.existsSync(file)) return;
      const w = fs.watch(file, () => this.refresh());
      this._watchers.push(w);
    };
    watch(path.join(memDir, 'semantic.json'));
    watch(path.join(memDir, 'episodes.jsonl'));
    watch(path.join(memDir, 'working.json'));
  }

  dispose(): void {
    this._watchers.forEach(w => w.close());
    this._watchers = [];
    this._onDidChangeTreeData.dispose();
  }

  refresh(): void {
    this._initMemory();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MemoryTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MemoryTreeItem): MemoryTreeItem[] {
    if (!element) return this._getRootSections();

    if (element.kind === 'section') {
      if (element.label.startsWith('🧠')) return this._getSemanticChildren();
      if (element.label.startsWith('📖')) return this._getEpisodicChildren();
      if (element.label.startsWith('⚡')) return this._getWorkingChildren();
    }
    return [];
  }

  // ── Root sections ──────────────────────────────────────────────────────────

  private _getRootSections(): MemoryTreeItem[] {
    if (!this._memory) {
      return [new MemoryTreeItem('No memory initialized', 'empty', vscode.TreeItemCollapsibleState.None, 'Open a project in TIMPS to start recording memory.')];
    }
    const stats = this._memory.getStats();
    return [
      new MemoryTreeItem(
        `🧠 Semantic Facts  (${stats.semanticCount})`,
        'section',
        stats.semanticCount > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
      ),
      new MemoryTreeItem(
        `📖 Recent Sessions  (${stats.episodeCount})`,
        'section',
        stats.episodeCount > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Collapsed,
      ),
      new MemoryTreeItem(
        `⚡ Working Memory  (${stats.workingFiles} files)`,
        'section',
        vscode.TreeItemCollapsibleState.Collapsed,
      ),
    ];
  }

  // ── Semantic facts ─────────────────────────────────────────────────────────

  private _getSemanticChildren(): MemoryTreeItem[] {
    if (!this._memory) return [];
    const entries = this._memory.getSemanticEntries();
    if (entries.length === 0) {
      return [new MemoryTreeItem('No facts recorded yet', 'empty', vscode.TreeItemCollapsibleState.None)];
    }
    return entries
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
      .slice(0, 50)
      .map(e => {
        const stars = '★'.repeat(Math.min(e.importance ?? 1, 5));
        const label = `[${e.type}] ${e.content.slice(0, 70)}`;
        const detail = `${stars}  accessed ${e.accessCount}×  ${new Date(e.createdAt).toLocaleDateString()}`;
        return new MemoryTreeItem(label, 'semantic-entry', vscode.TreeItemCollapsibleState.None, detail);
      });
  }

  // ── Episodes ───────────────────────────────────────────────────────────────

  private _getEpisodicChildren(): MemoryTreeItem[] {
    if (!this._memory) return [];
    const episodes = this._memory.loadEpisodes(15) as EpisodicMemory[];
    if (episodes.length === 0) {
      return [new MemoryTreeItem('No sessions recorded yet', 'empty', vscode.TreeItemCollapsibleState.None)];
    }
    return episodes.reverse().map(ep => {
      const dt = new Date(ep.timestamp).toLocaleString();
      const label = ep.summary?.slice(0, 70) ?? 'Session';
      return new MemoryTreeItem(label, 'episode', vscode.TreeItemCollapsibleState.None, dt);
    });
  }

  // ── Working memory ─────────────────────────────────────────────────────────

  private _getWorkingChildren(): MemoryTreeItem[] {
    if (!this._memory) return [];
    const w = this._memory.workingMemory;
    const items: MemoryTreeItem[] = [];

    if (w.currentGoal) {
      items.push(new MemoryTreeItem(
        `Goal: ${w.currentGoal.slice(0, 60)}`,
        'working-goal',
        vscode.TreeItemCollapsibleState.None,
        w.currentGoal,
      ));
    }

    for (const f of w.activeFiles.slice(-10)) {
      items.push(new MemoryTreeItem(
        path.basename(f),
        'working-file',
        vscode.TreeItemCollapsibleState.None,
        f,
      ));
    }

    for (const p of w.discoveredPatterns.slice(-5)) {
      items.push(new MemoryTreeItem(
        p.slice(0, 70),
        'working-pattern',
        vscode.TreeItemCollapsibleState.None,
        p,
      ));
    }

    if (items.length === 0) {
      items.push(new MemoryTreeItem('No active working memory', 'empty', vscode.TreeItemCollapsibleState.None));
    }
    return items;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create and register the Memory View provider.
 * Returns the provider so the extension can call .refresh() on demand.
 */
export function registerMemoryView(
  context: vscode.ExtensionContext,
  storageRoot: string,
): MemoryViewProvider {
  const provider = new MemoryViewProvider(storageRoot);

  const treeView = vscode.window.createTreeView('timps.memoryView', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  const refreshCmd = vscode.commands.registerCommand('timps.refreshMemory', () => {
    provider.refresh();
    vscode.window.showInformationMessage('TIMPS memory refreshed');
  });

  context.subscriptions.push(treeView, refreshCmd, { dispose: () => provider.dispose() });
  return provider;
}
