// ── @timps/memory-core — L20: RehearsalEngine ──
// Periodically surfaces stored memories to the agent for re-validation.
// Uses spaced repetition scheduling to decide which memories need review.
// Implements the "retrieval practice" and "generation effect" techniques.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateId } from './storage.js';
import { SpacedRepetitionForge } from './SpacedRepetitionForge.js';

export interface RehearsalItem {
  id: string;
  content: string;
  sourceLayer: string;
  sourceId: string;
  lastReviewed: number;
  reviewCount: number;
}

export interface RehearsalSession {
  items: RehearsalItem[];
  scheduledAt: number;
  completed: boolean;
}

export class RehearsalEngine {
  private rehearsalFile: string;
  private items: RehearsalItem[] = [];
  private srf: SpacedRepetitionForge;

  constructor(dir: string) {
    this.rehearsalFile = path.join(dir, 'rehearsal-items.json');
    this.srf = new SpacedRepetitionForge();
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.rehearsalFile)) {
        this.items = JSON.parse(fs.readFileSync(this.rehearsalFile, 'utf-8'));
      }
    } catch { this.items = []; }
  }

  private save(): void {
    fs.writeFileSync(this.rehearsalFile, JSON.stringify(this.items, null, 2), 'utf-8');
  }

  enqueue(content: string, sourceLayer: string, sourceId: string): RehearsalItem {
    const existing = this.items.find(i => i.sourceId === sourceId);
    if (existing) return existing;

    const item: RehearsalItem = {
      id: generateId('rhs'),
      content: content.slice(0, 500),
      sourceLayer,
      sourceId,
      lastReviewed: Date.now(),
      reviewCount: 0,
    };
    this.items.push(item);
    this.srf.schedule(item.id, true);
    this.save();
    return item;
  }

  getDueItems(limit = 5): RehearsalItem[] {
    const due = this.srf.dueForReview();
    return due
      .map(card => this.items.find(i => i.id === card.id))
      .filter((i): i is RehearsalItem => i !== undefined)
      .slice(0, limit);
  }

  review(itemId: string, success: boolean): void {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return;
    item.lastReviewed = Date.now();
    item.reviewCount++;
    this.srf.schedule(itemId, success);
    this.save();
  }

  get spacedRepetition(): SpacedRepetitionForge {
    return this.srf;
  }

  remove(sourceId: string): boolean {
    const before = this.items.length;
    this.items = this.items.filter(i => i.sourceId !== sourceId);
    if (this.items.length < before) { this.save(); return true; }
    return false;
  }

  count(): { total: number; dueNow: number } {
    return {
      total: this.items.length,
      dueNow: this.srf.dueForReview().length,
    };
  }
}
