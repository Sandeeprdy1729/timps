// ── Tool: Relationship Intelligence — track people you mention, alert on contact drift ──
// No calendar integration — purely based on what you write/store about people.

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Contact {
  name: string;             // canonical lowercase name
  aliases: string[];        // other ways they're mentioned
  first_seen: string;
  last_seen: string;
  mention_count: number;
  recent_topics: string[];  // last 3-5 topics you mentioned them in
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
}

export interface RelationshipCheck {
  contact: Contact;
  days_since_contact: number;
  drift_alert: boolean;     // true if >90 days AND mention_count > 0
  recommendation: string;
}

const POSITIVE_WORDS = /\b(?:love|great|amazing|excellent|thanks|appreciate|happy|excited|good|nice|helpful|smart|kind|brilliant|best)\b/i;
const NEGATIVE_WORDS = /\b(?:hate|frustrated|angry|disappointed|annoyed|terrible|bad|wrong|stupid|unhelpful|rude|ignored|missed|late)\b/i;
const DRIFT_DAYS = 90;

export class RelationshipIntelligence {
  private file: string;
  private contacts: Map<string, Contact> = new Map();

  constructor(dir: string) {
    this.file = path.join(dir, 'relationships.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        const arr: Contact[] = data.contacts || [];
        for (const c of arr) this.contacts.set(c.name, c);
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    fs.writeFileSync(this.file, JSON.stringify({ contacts: Array.from(this.contacts.values()) }, null, 2), 'utf-8');
  }

  /** Record that a person was mentioned in some context. */
  recordMention(name: string, context: string): Contact {
    const key = name.toLowerCase();
    const now = new Date().toISOString();
    const existing = this.contacts.get(key);
    if (existing) {
      existing.last_seen = now;
      existing.mention_count++;
      existing.recent_topics = [context.slice(0, 100), ...existing.recent_topics].slice(0, 5);
      if (POSITIVE_WORDS.test(context)) existing.sentiment = 'positive';
      else if (NEGATIVE_WORDS.test(context)) existing.sentiment = 'negative';
      this.save();
      return existing;
    }
    const c: Contact = {
      name: key,
      aliases: [name],
      first_seen: now,
      last_seen: now,
      mention_count: 1,
      recent_topics: [context.slice(0, 100)],
      sentiment: POSITIVE_WORDS.test(context) ? 'positive' : NEGATIVE_WORDS.test(context) ? 'negative' : 'neutral',
    };
    this.contacts.set(key, c);
    this.save();
    return c;
  }

  /** Check relationship health for one or all contacts. */
  check(name?: string): RelationshipCheck[] {
    const now = Date.now();
    const targets = name
      ? [this.contacts.get(name.toLowerCase())].filter((c): c is Contact => !!c)
      : Array.from(this.contacts.values());

    return targets.map(c => {
      const daysSince = Math.floor((now - new Date(c.last_seen).getTime()) / 86400000);
      const drift = daysSince > DRIFT_DAYS && c.mention_count > 0;
      let recommendation: string;
      if (drift) recommendation = `${c.name} hasn't been mentioned in ${daysSince} days. Consider reaching out.`;
      else if (c.sentiment === 'negative') recommendation = `Recent mentions of ${c.name} skew negative — consider following up.`;
      else if (c.mention_count < 3) recommendation = `${c.name} is a new contact. Log more context to build a relationship profile.`;
      else recommendation = `Healthy — last contact ${daysSince} day(s) ago, ${c.mention_count} total mentions.`;
      return { contact: c, days_since_contact: daysSince, drift_alert: drift, recommendation };
    });
  }

  /** List contacts with drift alerts. */
  driftAlerts(): RelationshipCheck[] {
    return this.check().filter(c => c.drift_alert);
  }
}
