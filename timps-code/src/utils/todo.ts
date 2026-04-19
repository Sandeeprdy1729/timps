// ── TIMPS Code — Todo Tracker ──
// Persistent per-project todos. Extracted automatically from agent output.
// Survives across sessions. TIMPS unique feature.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateId } from './utils.js';
import type { Todo } from './renderer.js';

export { Todo };

export class TodoStore {
  private file: string;
  private todos: Todo[] = [];

  constructor(projectId: string) {
    const dir = path.join(process.env.HOME ?? '~', '.timps', 'todos');
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, `${projectId}.json`);
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.file)) {
        this.todos = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      }
    } catch { this.todos = []; }
  }

  private save(): void {
    fs.writeFileSync(this.file, JSON.stringify(this.todos, null, 2), 'utf-8');
  }

  getAll(): Todo[] { return this.todos; }
  getOpen(): Todo[] { return this.todos.filter(t => !t.done); }
  getDone(): Todo[] { return this.todos.filter(t => t.done); }

  add(text: string, priority: Todo['priority'] = 'medium', source: Todo['source'] = 'user'): Todo {
    const todo: Todo = {
      id: generateId('todo'),
      text,
      done: false,
      priority,
      createdAt: Date.now(),
      source,
    };
    this.todos.push(todo);
    this.save();
    return todo;
  }

  markDone(idOrText: string): boolean {
    const todo = this.todos.find(t =>
      t.id === idOrText ||
      t.text.toLowerCase().includes(idOrText.toLowerCase())
    );
    if (!todo || todo.done) return false;
    todo.done = true;
    todo.doneAt = Date.now();
    this.save();
    return true;
  }

  remove(idOrText: string): boolean {
    const idx = this.todos.findIndex(t =>
      t.id === idOrText ||
      t.text.toLowerCase().includes(idOrText.toLowerCase())
    );
    if (idx === -1) return false;
    this.todos.splice(idx, 1);
    this.save();
    return true;
  }

  clear(doneOnly = true): number {
    const before = this.todos.length;
    if (doneOnly) {
      this.todos = this.todos.filter(t => !t.done);
    } else {
      this.todos = [];
    }
    this.save();
    return before - this.todos.length;
  }

  // Extract todos from agent output
  // Looks for patterns like "TODO:", "FIXME:", "- [ ]", numbered lists with action verbs
  extractFromText(text: string): number {
    let added = 0;
    const patterns = [
      /^[-*•]\s*\[\s*\]\s+(.{10,100})$/gm,             // - [ ] task
      /^TODO[:\s]+(.{10,100})$/gim,                      // TODO: task
      /^FIXME[:\s]+(.{10,100})$/gim,                     // FIXME: task
      /^(?:\d+\.)\s+(?:(?:create|build|add|implement|fix|update|write|setup|configure|test|refactor)\s+.{10,80})$/gim,
    ];

    const existingTexts = new Set(this.todos.map(t => t.text.toLowerCase()));

    for (const re of patterns) {
      let match;
      while ((match = re.exec(text)) !== null) {
        const taskText = match[1].trim();
        if (taskText.length < 10 || existingTexts.has(taskText.toLowerCase())) continue;
        this.add(taskText, 'medium', 'agent');
        existingTexts.add(taskText.toLowerCase());
        added++;
      }
    }

    return added;
  }

  stats(): { open: number; done: number; agentAdded: number } {
    return {
      open: this.todos.filter(t => !t.done).length,
      done: this.todos.filter(t => t.done).length,
      agentAdded: this.todos.filter(t => t.source === 'agent').length,
    };
  }
}