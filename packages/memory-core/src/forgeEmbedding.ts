// @timps/memory-core — forgeEmbedding.ts
// Shared, honest primitives for the L12–L15 forge family (QPTW, TitanicForge,
// QERW, QISRD). This module replaces the per-file pseudo-scientific hash tricks
// with one deterministic feature-hash embedding (mirroring the native addon in
// packages/memory-core-rs), real similarity/distance metrics, a small stance
// lexicon, and content-based contradiction checks.
//
// Nothing in this file is benchmarked and no "provable" claims are made — these
// are plain utility primitives with well-understood behavior.

/** 32-bit FNV-1a hash (offset basis 2166136261, prime 16777619). */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Normalize text the same way the native addon does: keep lowercase
 * alphanumerics + apostrophes + underscores, collapse whitespace to spaces, and
 * map punctuation to a sentinel so punctuation-only boundaries don't merge
 * distinct words.
 */
export function normalizeText(text: string): string {
  let out = "";
  for (const ch of text) {
    const c = ch.toLowerCase();
    if ((c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === "'" || c === "_") {
      out += c;
    } else if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      out += " ";
    } else {
      out += "\n";
    }
  }
  return out;
}

/** Split normalized text into words. */
export function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter(w => w.length > 0);
}

/**
 * Deterministic feature-hash embedding (dimension `dim`), mirroring the native
 * `get_embedding`: word unigrams (1.0), word bigrams (0.5), char trigrams
 * (0.25) hashed into buckets with a sign bit, weighted `1 + ln(count)`,
 * L2-normalized. Text that shares words/n-grams scores higher cosine similarity.
 */
export function featureHashEmbed(content: string, dim: number): Float64Array {
  const tf = new Map<number, number>();
  const words = tokenize(content);

  for (const w of words) {
    const h = fnv1a(w);
    tf.set(h, (tf.get(h) ?? 0) + 1.0);
  }
  for (let i = 0; i + 1 < words.length; i++) {
    const h = fnv1a(`${words[i]}~${words[i + 1]}`);
    tf.set(h, (tf.get(h) ?? 0) + 0.5);
  }
  const joined = words.join(" ");
  if (joined.length >= 3) {
    for (let i = 0; i + 3 <= joined.length; i++) {
      const h = fnv1a(joined.slice(i, i + 3));
      tf.set(h, (tf.get(h) ?? 0) + 0.25);
    }
  }

  const v = new Float64Array(dim);
  for (const [h, count] of tf) {
    const idx = h % dim;
    const sign = ((h >>> 31) & 1) === 1 ? 1 : -1;
    v[idx] += sign * (1 + Math.log(count));
  }
  let norm = 0;
  for (let d = 0; d < dim; d++) norm += v[d] * v[d];
  norm = Math.sqrt(norm) || 1;
  for (let d = 0; d < dim; d++) v[d] /= norm;
  return v;
}

/** Cosine similarity between two vectors (clamped to [-1, 1]). */
export function cosineSim(a: Float64Array | number[], b: Float64Array | number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return Math.max(-1, Math.min(1, dot / denom));
}

/**
 * Fisher-Rao geodesic distance on the unit hypersphere: arccos(cosine_sim).
 * The natural distance for L2-normalized embeddings.
 */
export function fisherRaoDist(a: Float64Array | number[], b: Float64Array | number[]): number {
  return Math.acos(Math.max(-0.9999, Math.min(0.9999, cosineSim(a, b))));
}

/** Token-level Jaccard similarity (stopwords removed). */
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "of", "to", "in",
  "on", "for", "and", "or", "with", "at", "by", "from", "as", "it", "its",
  "this", "that", "which", "who", "them", "their", "they", "we", "you", "i",
]);

export function tokenJaccard(a: string, b: string): number {
  const ta = tokenize(a).filter(t => !STOPWORDS.has(t));
  const tb = tokenize(b).filter(t => !STOPWORDS.has(t));
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  const shared = new Set(ta.filter(t => setB.has(t)));
  const union = new Set([...ta, ...tb]);
  return shared.size / union.size;
}

const POSITIVE_WORDS = new Set([
  "use", "adopt", "adopted", "prefer", "preferred", "choose", "chosen",
  "recommend", "recommended", "like", "liked", "love", "good", "great", "best",
  "support", "supported", "supports", "works", "stable", "reliable", "keep",
  "kept", "approve", "approved", "improve", "improved", "faster", "better",
  "enable", "enabled", "allows", "yes",
]);

const NEGATIVE_WORDS = new Set([
  "avoid", "avoided", "reject", "rejected", "abandon", "abandoned", "remove",
  "removed", "stop", "stopped", "drop", "dropped", "dislike", "hate", "bad",
  "worse", "worst", "fails", "failed", "broken", "unreliable", "problem",
  "problems", "against", "uninstall", "downgrade", "disallow", "disallowed",
  "deprecate", "deprecated", "kill", "no",
]);

const NEGATION_WORDS = new Set([
  "not", "never", "without", "don't", "dont", "doesn't", "isn't", "aren't",
  "won't", "no",
]);

/**
 * Lexicon-based stance polarity in [-1, 1]: +1 = supportive/affirmative,
 * -1 = opposed/negative, 0 = neutral. A negation word flips the polarity of the
 * next stance word it precedes (e.g. "do not use" → negative).
 */
export function stancePolarity(text: string): number {
  const tokens = tokenize(text);
  let pos = 0;
  let neg = 0;
  let negateNext = false;
  for (const t of tokens) {
    if (NEGATION_WORDS.has(t)) {
      negateNext = true;
      continue;
    }
    let sign = 0;
    if (POSITIVE_WORDS.has(t)) sign = 1;
    else if (NEGATIVE_WORDS.has(t)) sign = -1;
    if (sign !== 0) {
      if (negateNext) sign = -sign;
      negateNext = false;
      if (sign > 0) pos++;
      else neg++;
    }
  }
  if (pos + neg === 0) return 0;
  return (pos - neg) / (pos + neg);
}

/** Minimum token Jaccard overlap required to consider two texts "same topic". */
export const CONTRADICTION_JACCARD_THRESHOLD = 0.2;

/**
 * Content-based contradiction check: two statements contradict when they share
 * enough vocabulary (same topic) and take opposing stances. Deliberately
 * conservative — it only fires on clear lexical signals, never on hash
 * coincidence.
 */
export function isContradictory(contentA: string, contentB: string): boolean {
  const j = tokenJaccard(contentA, contentB);
  if (j < CONTRADICTION_JACCARD_THRESHOLD) return false;
  const sa = stancePolarity(contentA);
  const sb = stancePolarity(contentB);
  if (sa === 0 || sb === 0) return false;
  return Math.sign(sa) !== Math.sign(sb);
}

/**
 * Deterministic seeded PRNG (mulberry32) for reproducible stochastic processes.
 * Seed once from a real entropy source; draws are uniform in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mean embedding of a set of nodes (centroid), L2-normalized if nonzero. */
export function domainCentroid(
  embeddings: Array<Float64Array | number[]>,
  dim: number,
): Float64Array {
  const c = new Float64Array(dim);
  for (const e of embeddings) {
    for (let i = 0; i < dim; i++) c[i] += e[i];
  }
  if (embeddings.length > 0) {
    for (let i = 0; i < dim; i++) c[i] /= embeddings.length;
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += c[i] * c[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) c[i] /= norm;
  return c;
}

/**
 * Domain coherence over a recency-ordered set of similarity scores:
 * `coherence` = mean recent similarity to the centroid (higher = more
 * internally consistent), `instability` = std-dev of those similarities
 * (higher = the domain is oscillating between agreeing and disagreeing).
 */
export function coherenceStats(
  scores: number[],
  window = Math.min(8, scores.length),
): { coherence: number; instability: number } {
  if (scores.length === 0) return { coherence: 0, instability: 0 };
  const recent = scores.slice(-window);
  const coherence = recent.reduce((s, v) => s + v, 0) / recent.length;
  const mean = coherence;
  const variance = recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length;
  return { coherence, instability: Math.sqrt(variance) };
}
