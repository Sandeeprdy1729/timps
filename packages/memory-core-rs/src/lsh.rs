// ──────────────────────────────────────────────────────────────────────────────
// TIMPS LSH — Rust-native Locality-Sensitive Hashing for O(1) candidate lookup.
// Phase 4d: replaces TypeScript LSHIndex with zero-GC, SIMD-friendly Rust.
// Deterministic: seeded by golden-ratio sin, no Math.random().
// ──────────────────────────────────────────────────────────────────────────────

use std::collections::HashMap;

use napi_derive::napi;

const EMBED_DIM: usize = 64;
const NUM_HASH_TABLES: u32 = 4;
const NUM_BITS: u32 = 8;

fn murmurhash_str(s: &str) -> u32 {
    let mut h: u32 = 0xdeadbeef;
    for b in s.bytes() {
        h = h.wrapping_mul(0x9e3779b9) ^ (b as u32);
        h ^= h >> 16;
    }
    h
}

fn embed(text: &str) -> HashMap<u32, f64> {
    let lower: String = text
        .chars()
        .map(|c| if c.is_alphanumeric() || c.is_whitespace() { c } else { ' ' })
        .collect();
    let tokens: Vec<&str> = lower
        .split_whitespace()
        .filter(|t| t.len() > 1)
        .collect();
    if tokens.is_empty() {
        return HashMap::new();
    }
    let mut tf: HashMap<u32, f64> = HashMap::new();
    for tok in &tokens {
        let d = murmurhash_str(tok) % (EMBED_DIM as u32);
        *tf.entry(d).or_insert(0.0) += 1.0;
    }
    let total = tokens.len() as f64;
    for v in tf.values_mut() {
        *v /= total;
    }
    // L2 normalize
    let norm: f64 = tf.values().map(|v| v * v).sum::<f64>().sqrt();
    if norm > 0.0 {
        for v in tf.values_mut() {
            *v /= norm;
        }
    }
    tf
}

fn deterministic_projection(table: u32, bit: u32, dim: u32) -> f64 {
    let seed = (table * NUM_BITS + bit) as f64 + 1.0;
    (seed * (dim as f64 + 1.0) * 0.618033988749895).sin() * 2.0 - 1.0
}

fn signature(embedding: &HashMap<u32, f64>, projections: &[[[f64; EMBED_DIM]; NUM_BITS as usize]; NUM_HASH_TABLES as usize]) -> Vec<u32> {
    let mut sigs = Vec::with_capacity(NUM_HASH_TABLES as usize);
    for t in 0..NUM_HASH_TABLES as usize {
        let mut sig: u32 = 0;
        for b in 0..NUM_BITS as usize {
            let mut dot = 0.0f64;
            for (&dim, &val) in embedding {
                let proj = projections[t][b][dim as usize];
                dot += proj * val;
            }
            if dot > 0.0 {
                sig |= 1u32 << b;
            }
        }
        sigs.push(sig);
    }
    sigs
}

#[napi]
pub struct RustLSH {
    num_tables: u32,
    num_bits: u32,
    projections: [[[f64; EMBED_DIM]; NUM_BITS as usize]; NUM_HASH_TABLES as usize],
    buckets: [HashMap<u32, Vec<String>>; NUM_HASH_TABLES as usize],
    items: HashMap<String, String>,
}

#[napi]
impl RustLSH {
    #[napi(constructor)]
    pub fn new() -> Self {
        // Precompute deterministic projections
        let mut projections = [[[0.0f64; EMBED_DIM]; NUM_BITS as usize]; NUM_HASH_TABLES as usize];
        for t in 0..NUM_HASH_TABLES {
            for b in 0..NUM_BITS {
                for d in 0..EMBED_DIM as u32 {
                    projections[t as usize][b as usize][d as usize] = deterministic_projection(t, b, d);
                }
            }
        }

        // Initialize buckets array using Default
        let buckets = [
            HashMap::new(), HashMap::new(), HashMap::new(), HashMap::new(),
        ];

        RustLSH {
            num_tables: NUM_HASH_TABLES,
            num_bits: NUM_BITS,
            projections,
            buckets,
            items: HashMap::new(),
        }
    }

    #[napi]
    pub fn insert(&mut self, id: String, content: String) {
        self.items.insert(id.clone(), content.clone());
        let emb = embed(&content);
        let sigs = signature(&emb, &self.projections);
        for t in 0..self.num_tables as usize {
            let sig = sigs[t];
            let bucket = &mut self.buckets[t];
            let ids = bucket.entry(sig).or_insert_with(Vec::new);
            if !ids.contains(&id) {
                ids.push(id.clone());
            }
        }
    }

    #[napi]
    pub fn query(&self, content: String, max_results: Option<i32>) -> Vec<String> {
        let max = max_results.unwrap_or(-1).max(0) as usize;
        let emb = embed(&content);
        let sigs = signature(&emb, &self.projections);
        let mut seen = std::collections::HashSet::new();
        let mut results = Vec::new();

        for t in 0..self.num_tables as usize {
            let sig = sigs[t];
            if let Some(bucket) = self.buckets[t].get(&sig) {
                for id in bucket {
                    if seen.contains(id) {
                        continue;
                    }
                    seen.insert(id.clone());
                    results.push(id.clone());
                    if max > 0 && results.len() >= max {
                        return results;
                    }
                }
            }
        }
        results
    }

    #[napi]
    pub fn delete(&mut self, id: String) {
        self.items.remove(&id);
        for t in 0..self.num_tables as usize {
            let bucket = &mut self.buckets[t];
            bucket.retain(|_, ids| {
                ids.retain(|i| i != &id);
                !ids.is_empty()
            });
        }
    }

    #[napi]
    pub fn size(&self) -> u32 {
        self.items.len() as u32
    }

    #[napi]
    pub fn clear(&mut self) {
        self.items.clear();
        for t in 0..self.num_tables as usize {
            self.buckets[t].clear();
        }
    }

    #[napi]
    pub fn get_all(&self) -> Vec<String> {
        self.items.keys().cloned().collect()
    }
}
