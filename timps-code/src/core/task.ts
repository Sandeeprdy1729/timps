// task.ts - Task Management System
// Persistent task tracking with project context

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getMemoryDir } from '../config/config.js';
import { generateId } from '../utils/utils.js';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  subtasks?: Task[];
  dependencies?: string[];
  context?: string;
}

export interface TaskFilter {
  status?: Task['status'][];
  priority?: Task['priority'];
  tags?: string[];
  search?: string;
}

export class TaskStore {
  private filePath: string;
  private tasks: Map<string, Task> = new Map();

  constructor(projectPath: string) {
    const dir = getMemoryDir(projectPath);
    this.filePath = path.join(dir, 'tasks.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        for (const task of data.tasks || []) {
          this.tasks.set(task.id, task);
        }
      }
    } catch {
      this.tasks = new Map();
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify({
      tasks: Array.from(this.tasks.values()),
      updatedAt: Date.now(),
    }, null, 2), 'utf-8');
  }

  create(title: string, opts: Partial<Task> = {}): Task {
    const task: Task = {
      id: generateId('task'),
      title,
      description: opts.description,
      status: opts.status || 'pending',
      priority: opts.priority || 'medium',
      tags: opts.tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      subtasks: opts.subtasks,
      dependencies: opts.dependencies,
      context: opts.context,
    };

    this.tasks.set(task.id, task);
    this.save();
    return task;
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  update(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    const updated = {
      ...task,
      ...updates,
      id: task.id,
      updatedAt: Date.now(),
    };

    if (updates.status === 'completed' && !task.completedAt) {
      updated.completedAt = Date.now();
    }

    this.tasks.set(id, updated);
    this.save();
    return updated;
  }

  delete(id: string): boolean {
    const result = this.tasks.delete(id);
    if (result) this.save();
    return result;
  }

  list(filter?: TaskFilter): Task[] {
    let tasks = Array.from(this.tasks.values());

    if (filter) {
      if (filter.status && filter.status.length > 0) {
        tasks = tasks.filter(t => filter.status!.includes(t.status));
      }
      if (filter.priority) {
        tasks = tasks.filter(t => t.priority === filter.priority);
      }
      if (filter.tags && filter.tags.length > 0) {
        tasks = tasks.filter(t => filter.tags!.some(tag => t.tags.includes(tag)));
      }
      if (filter.search) {
        const search = filter.search.toLowerCase();
        tasks = tasks.filter(t =>
          t.title.toLowerCase().includes(search) ||
          t.description?.toLowerCase().includes(search)
        );
      }
    }

    return tasks.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const statusOrder = { in_progress: 0, pending: 1, completed: 2, cancelled: 3 };
      
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  complete(id: string): Task | undefined {
    return this.update(id, { status: 'completed' });
  }

  cancel(id: string): Task | undefined {
    return this.update(id, { status: 'cancelled' });
  }

  start(id: string): Task | undefined {
    return this.update(id, { status: 'in_progress' });
  }

  getStats(): { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> } {
    const tasks = Array.from(this.tasks.values());
    
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
      byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
    }

    return {
      total: tasks.length,
      byStatus,
      byPriority,
    };
  }

  getOpen(): Task[] {
    return this.list({ status: ['pending', 'in_progress'] });
  }

  getCompleted(): Task[] {
    return this.list({ status: ['completed'] });
  }

  clearCompleted(): number {
    const completed = this.getCompleted();
    for (const task of completed) {
      this.tasks.delete(task.id);
    }
    if (completed.length > 0) this.save();
    return completed.length;
  }

  addSubtask(parentId: string, title: string): Task | undefined {
    const parent = this.tasks.get(parentId);
    if (!parent) return undefined;

    const subtask = this.create(title, {
      context: parent.context,
      tags: parent.tags,
    });

    if (!parent.subtasks) parent.subtasks = [];
    parent.subtasks.push(subtask);
    parent.updatedAt = Date.now();
    this.save();

    return subtask;
  }

  getDependencies(id: string): Task[] {
    const task = this.tasks.get(id);
    if (!task?.dependencies) return [];
    return task.dependencies
      .map(depId => this.tasks.get(depId))
      .filter((t): t is Task => t !== undefined);
  }

  canStart(id: string): { canStart: boolean; blockedBy?: Task[] } {
    const task = this.tasks.get(id);
    if (!task) return { canStart: false };

    if (task.status !== 'pending') return { canStart: task.status === 'in_progress' };

    const blockedBy: Task[] = [];
    for (const depId of task.dependencies || []) {
      const dep = this.tasks.get(depId);
      if (dep && dep.status !== 'completed') {
        blockedBy.push(dep);
      }
    }

    return { canStart: blockedBy.length === 0, blockedBy };
  }

  exportTasks(): string {
    return JSON.stringify(Array.from(this.tasks.values()), null, 2);
  }

  importTasks(json: string): number {
    try {
      const tasks = JSON.parse(json) as Task[];
      let imported = 0;
      for (const task of tasks) {
        if (!this.tasks.has(task.id)) {
          this.tasks.set(task.id, task);
          imported++;
        }
      }
      if (imported > 0) this.save();
      return imported;
    } catch {
      return 0;
    }
  }
}
