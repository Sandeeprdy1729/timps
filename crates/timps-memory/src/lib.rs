//! timps-memory — Pure-Rust memory store for the TIMPS agent.
//! Mirrors the 3-layer memory model from @timps/memory-core (TypeScript):
//!   Working  → in-process HashMap (session only)
//!   Episodic → ~/.timps/memory/<hash>/episodes.jsonl
//!   Semantic → ~/.timps/memory/<hash>/semantic.json

use anyhow::Result;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

// ── Domain types (mirror @timps/memory-core types) ─────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticEntry {
    pub key: String,
    pub value: String,
    pub importance: f32,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpisodicEntry {
    pub task: String,
    pub outcome: String,   // "success" | "failed"
    pub summary: String,
    pub timestamp: String,
}

// ── MemoryStore ─────────────────────────────────────────────────────────────

pub struct MemoryStore {
    dir: PathBuf,
    working: Arc<RwLock<HashMap<String, String>>>,
}

impl MemoryStore {
    /// Open the memory store for `project_path`.
    /// Creates `~/.timps/memory/<hash>/` if it doesn't exist.
    pub fn open(project_path: &str) -> Result<Self> {
        let hash = project_hash(project_path);
        let dir = dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("no home dir"))?
            .join(".timps")
            .join("memory")
            .join(&hash);
        fs::create_dir_all(&dir)?;
        Ok(Self {
            dir,
            working: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    // ── Working memory ──────────────────────────────────────────────────────

    pub fn set_working(&self, key: &str, value: &str) {
        self.working.write().unwrap().insert(key.to_string(), value.to_string());
    }

    pub fn get_working(&self, key: &str) -> Option<String> {
        self.working.read().unwrap().get(key).cloned()
    }

    pub fn clear_working(&self) {
        self.working.write().unwrap().clear();
    }

    // ── Semantic memory ─────────────────────────────────────────────────────

    pub async fn load_semantic(&self) -> Result<Vec<SemanticEntry>> {
        let path = self.dir.join("semantic.json");
        if !path.exists() { return Ok(vec![]); }
        let content = tokio::fs::read_to_string(&path).await?;
        Ok(serde_json::from_str(&content).unwrap_or_default())
    }

    pub async fn save_semantic(&self, entries: &[SemanticEntry]) -> Result<()> {
        let path = self.dir.join("semantic.json");
        let content = serde_json::to_string_pretty(entries)?;
        tokio::fs::write(path, content).await?;
        Ok(())
    }

    pub async fn store_semantic(&self, entry: SemanticEntry) -> Result<()> {
        let mut entries = self.load_semantic().await?;
        if let Some(existing) = entries.iter_mut().find(|e| e.key == entry.key) {
            *existing = entry;
        } else {
            entries.push(entry);
        }
        self.save_semantic(&entries).await
    }

    /// Search semantic memory for entries relevant to `query` (simple substring match).
    /// Full semantic search (embeddings) is a Phase 17+ feature.
    pub async fn search_relevant(&self, query: &str, limit: usize) -> Result<Vec<SemanticEntry>> {
        let entries = self.load_semantic().await?;
        let query_lower = query.to_lowercase();
        let mut scored: Vec<(f32, SemanticEntry)> = entries
            .into_iter()
            .filter_map(|e| {
                let score = if e.key.to_lowercase().contains(&query_lower)
                    || e.value.to_lowercase().contains(&query_lower) {
                    e.importance + 0.5
                } else if e.tags.iter().any(|t| t.to_lowercase().contains(&query_lower)) {
                    e.importance
                } else {
                    return None;
                };
                Some((score, e))
            })
            .collect();
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
        Ok(scored.into_iter().take(limit).map(|(_, e)| e).collect())
    }

    // ── Episodic memory ─────────────────────────────────────────────────────

    pub async fn load_episodes(&self, limit: usize) -> Result<Vec<EpisodicEntry>> {
        let path = self.dir.join("episodes.jsonl");
        if !path.exists() { return Ok(vec![]); }
        let file = fs::File::open(&path)?;
        let reader = BufReader::new(file);
        let mut episodes: Vec<EpisodicEntry> = reader
            .lines()
            .filter_map(|l| l.ok())
            .filter_map(|l| serde_json::from_str(&l).ok())
            .collect();
        episodes.reverse();
        episodes.truncate(limit);
        Ok(episodes)
    }

    pub async fn append_episode(&self, entry: EpisodicEntry) -> Result<()> {
        let path = self.dir.join("episodes.jsonl");
        let mut file = fs::OpenOptions::new().create(true).append(true).open(path)?;
        let line = serde_json::to_string(&entry)?;
        writeln!(file, "{}", line)?;
        Ok(())
    }

    /// Returns episodes that mention similar tasks (for recipe memory injection).
    pub async fn search_episodes(&self, task: &str, limit: usize) -> Result<Vec<EpisodicEntry>> {
        let episodes = self.load_episodes(500).await?;
        let query = task.to_lowercase();
        let mut matched: Vec<EpisodicEntry> = episodes
            .into_iter()
            .filter(|e| e.task.to_lowercase().contains(&query))
            .take(limit)
            .collect();
        matched.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(matched)
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

pub fn project_hash(path: &str) -> String {
    let canonical = fs::canonicalize(path)
        .unwrap_or_else(|_| Path::new(path).to_path_buf());
    let mut hasher = Sha256::new();
    hasher.update(canonical.to_string_lossy().as_bytes());
    hex::encode(&hasher.finalize()[..6])
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_semantic_roundtrip() {
        let dir = tempdir().unwrap();
        let store = MemoryStore {
            dir: dir.path().to_path_buf(),
            working: Arc::new(RwLock::new(HashMap::new())),
        };
        store.store_semantic(SemanticEntry {
            key: "pattern".to_string(),
            value: "always use async/await".to_string(),
            importance: 0.9,
            tags: vec!["coding".to_string()],
        }).await.unwrap();
        let results = store.search_relevant("async", 5).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].key, "pattern");
    }

    #[tokio::test]
    async fn test_episode_roundtrip() {
        let dir = tempdir().unwrap();
        let store = MemoryStore {
            dir: dir.path().to_path_buf(),
            working: Arc::new(RwLock::new(HashMap::new())),
        };
        store.append_episode(EpisodicEntry {
            task: "refactor auth".to_string(),
            outcome: "success".to_string(),
            summary: "extracted to auth.ts".to_string(),
            timestamp: "2026-05-08T00:00:00Z".to_string(),
        }).await.unwrap();
        let episodes = store.load_episodes(10).await.unwrap();
        assert_eq!(episodes.len(), 1);
    }

    #[test]
    fn test_working_memory() {
        let store = MemoryStore {
            dir: PathBuf::from("/tmp"),
            working: Arc::new(RwLock::new(HashMap::new())),
        };
        store.set_working("goal", "fix bug");
        assert_eq!(store.get_working("goal"), Some("fix bug".to_string()));
        store.clear_working();
        assert_eq!(store.get_working("goal"), None);
    }
}
