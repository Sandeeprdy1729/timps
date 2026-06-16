// ── @timps/memory-core — L14: SpacedRepetitionForge ──
// SM-2 algorithm for scheduling memory review.
// Predicts retrievability and schedules reviews at optimal intervals
// to flatten the Ebbinghaus forgetting curve.

export interface RepetitionCard {
  id: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number;
  lastReview: number;
  retrievability: number;
}

export class SpacedRepetitionForge {
  private cards: Map<string, RepetitionCard>;

  constructor() {
    this.cards = new Map();
  }

  schedule(id: string, success: boolean): RepetitionCard {
    const now = Date.now();
    const card = this.cards.get(id) ?? {
      id,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: now,
      lastReview: now,
      retrievability: 1.0,
    };

    if (success) {
      card.repetitions += 1;
      if (card.repetitions === 1) card.interval = 1;
      else if (card.repetitions === 2) card.interval = 3;
      else card.interval = Math.round(card.interval * card.easeFactor);
      card.easeFactor = Math.max(1.3, card.easeFactor + 0.1);
      card.retrievability = 1.0;
    } else {
      card.repetitions = 0;
      card.interval = 1;
      card.easeFactor = Math.max(1.3, card.easeFactor - 0.2);
      card.retrievability = 0.3;
    }

    card.lastReview = now;
    card.nextReview = now + card.interval * 24 * 60 * 60 * 1000;
    this.cards.set(id, card);
    return card;
  }

  dueForReview(now = Date.now()): RepetitionCard[] {
    return [...this.cards.values()].filter(c => c.nextReview <= now);
  }

  predictedRetrievability(id: string, atMs = Date.now()): number {
    const card = this.cards.get(id);
    if (!card) return 0.5;
    const elapsedDays = (atMs - card.lastReview) / (24 * 60 * 60 * 1000);
    const intervalDays = card.interval * card.easeFactor;
    if (intervalDays <= 0) return 1;
    return Math.exp(-elapsedDays / intervalDays);
  }

  getCard(id: string): RepetitionCard | undefined {
    return this.cards.get(id);
  }

  getAllCards(): RepetitionCard[] {
    return [...this.cards.values()];
  }

  deleteCard(id: string): boolean {
    return this.cards.delete(id);
  }

  resetCard(id: string): RepetitionCard | undefined {
    const existing = this.cards.get(id);
    if (!existing) return undefined;
    const reset: RepetitionCard = {
      id,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: Date.now(),
      lastReview: Date.now(),
      retrievability: 1.0,
    };
    this.cards.set(id, reset);
    return reset;
  }

  cardCount(): number {
    return this.cards.size;
  }
}
