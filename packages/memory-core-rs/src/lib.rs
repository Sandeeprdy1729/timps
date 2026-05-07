// ── TIMPS memory-core-rs ──
// Native Rust implementations of memory-core's hot-path operations,
// exposed to Node.js via NAPI-RS. All functions mirror the TypeScript
// equivalents in @timps/memory-core exactly.

#![deny(clippy::all)]
#![allow(clippy::new_without_default)]

use napi_derive::napi;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;

// ──────────────────────────────────────────────────────────────────────────────
// project_hash — SHA-256 of canonicalized path, first 12 hex chars
// ──────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn project_hash(path: String) -> String {
    let canonical = fs::canonicalize(&path)
        .unwrap_or_else(|_| Path::new(&path).to_path_buf());
    let canonical_str = canonical.to_string_lossy();
    let mut hasher = Sha256::new();
    hasher.update(canonical_str.as_bytes());
    let digest = hasher.finalize();
    hex::encode(&digest[..6]) // 6 bytes = 12 hex chars
}

// ──────────────────────────────────────────────────────────────────────────────
// Semantic memory (semantic.json)
// ──────────────────────────────────────────────────────────────────────────────

/// Read semantic.json, returns raw JSON string (array). Empty array on missing/error.
#[napi]
pub fn load_semantic(dir: String) -> String {
    let p = format!("{}/semantic.json", dir);
    fs::read_to_string(&p).unwrap_or_else(|_| "[]".to_string())
}

/// Write semantic.json, trimming array to 500 most recent entries.
#[napi]
pub fn save_semantic(dir: String, json: String) -> napi::Result<()> {
    let trimmed = trim_json_array_str(&json, 500);
    let p = format!("{}/semantic.json", dir);
    fs::write(&p, trimmed.as_bytes()).map_err(|e| napi::Error::from_reason(e.to_string()))
}

// ──────────────────────────────────────────────────────────────────────────────
// Working memory (working.json)
// ──────────────────────────────────────────────────────────────────────────────

/// Read working.json, returns raw JSON string. Default object on missing/error.
#[napi]
pub fn load_working(dir: String) -> String {
    let p = format!("{}/working.json", dir);
    fs::read_to_string(&p).unwrap_or_else(|_| {
        r#"{"activeFiles":[],"recentErrors":[],"discoveredPatterns":[]}"#.to_string()
    })
}

/// Write working.json.
#[napi]
pub fn save_working(dir: String, json: String) -> napi::Result<()> {
    let p = format!("{}/working.json", dir);
    fs::write(&p, json.as_bytes()).map_err(|e| napi::Error::from_reason(e.to_string()))
}

// ──────────────────────────────────────────────────────────────────────────────
// Episodic memory (episodes.jsonl)
// ──────────────────────────────────────────────────────────────────────────────

/// Read last `count` lines from episodes.jsonl, return as JSON array string.
/// Entries are returned in file order (oldest of the window first), matching
/// the TypeScript storage.loadEpisodes() contract.
#[napi]
pub fn load_episodes(dir: String, count: u32) -> String {
    let p = format!("{}/episodes.jsonl", dir);
    let file = match fs::File::open(&p) {
        Ok(f) => f,
        Err(_) => return "[]".to_string(),
    };
    let lines: Vec<String> = BufReader::new(file)
        .lines()
        .filter_map(|l| l.ok())
        .filter(|l| !l.trim().is_empty())
        .collect();

    let count_usize = count as usize;
    let start = lines.len().saturating_sub(count_usize);
    let selected = &lines[start..];
    // File order (oldest in window first) — matches TypeScript behaviour
    let items: Vec<&str> = selected.iter().map(|s| s.as_str()).collect();
    format!("[{}]", items.join(","))
}

/// Append one JSON episode line to episodes.jsonl, then trim to 100 lines.
#[napi]
pub fn append_episode(dir: String, json: String) -> napi::Result<()> {
    let p = format!("{}/episodes.jsonl", dir);
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&p)
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    writeln!(file, "{}", json).map_err(|e| napi::Error::from_reason(e.to_string()))?;
    trim_jsonl_file(&p, 100);
    Ok(())
}

// ──────────────────────────────────────────────────────────────────────────────
// jaccard_similarity — Jaccard on word sets (words >2 chars)
// ──────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn jaccard_similarity(a: String, b: String) -> f64 {
    let sa = a.to_lowercase();
    let sb = b.to_lowercase();
    let set_a: HashSet<&str> = sa.split_whitespace().filter(|w| w.len() > 2).collect();
    let set_b: HashSet<&str> = sb.split_whitespace().filter(|w| w.len() > 2).collect();

    if set_a.is_empty() && set_b.is_empty() {
        return 1.0;
    }
    if set_a.is_empty() || set_b.is_empty() {
        return 0.0;
    }

    let intersection = set_a.intersection(&set_b).count();
    let union = set_a.len() + set_b.len() - intersection;
    intersection as f64 / union as f64
}

// ──────────────────────────────────────────────────────────────────────────────
// search_entries — fast keyword search over MemoryEntry[] JSON
// Implements TF-weighted scoring: content×2, tags×1, type×0.5
// Returns JSON array string of matching entries, up to `limit`, scored descending.
// ──────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn search_entries(entries_json: String, query: String, limit: u32) -> String {
    let entries: Vec<serde_json::Value> = match serde_json::from_str(&entries_json) {
        Ok(v) => v,
        Err(_) => return "[]".to_string(),
    };

    if query.trim().is_empty() {
        let end = (limit as usize).min(entries.len());
        return serde_json::to_string(&entries[..end]).unwrap_or_else(|_| "[]".to_string());
    }

    let q_lower = query.to_lowercase();
    let query_words: Vec<String> = q_lower
        .split_whitespace()
        .filter(|w| w.len() > 2)
        .map(|w| w.to_string())
        .collect();

    let mut scored: Vec<(f64, &serde_json::Value)> = entries
        .iter()
        .filter_map(|entry| {
            let content = entry
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            let entry_type = entry
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            let tags: Vec<String> = entry
                .get("tags")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| s.to_lowercase())
                        .collect()
                })
                .unwrap_or_default();

            let mut score = 0.0f64;
            for word in &query_words {
                // Content matches — TF weight ×2
                let matches_in_content = content.matches(word.as_str()).count();
                score += matches_in_content as f64 * 2.0;
                // Tag matches — weight ×1
                for tag in &tags {
                    if tag.contains(word.as_str()) {
                        score += 1.0;
                    }
                }
                // Type match — weight ×0.5
                if entry_type.contains(word.as_str()) {
                    score += 0.5;
                }
            }
            // Prefix bonus
            if query_words
                .iter()
                .any(|w| content.starts_with(w.as_str()))
            {
                score += 1.0;
            }

            if score > 0.0 {
                Some((score, entry))
            } else {
                None
            }
        })
        .collect();

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    let results: Vec<&serde_json::Value> = scored
        .iter()
        .take(limit as usize)
        .map(|(_, e)| *e)
        .collect();

    serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string())
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────────

fn trim_json_array_str(json: &str, max: usize) -> String {
    match serde_json::from_str::<Vec<serde_json::Value>>(json) {
        Ok(arr) if arr.len() > max => {
            let trimmed = arr[arr.len() - max..].to_vec();
            serde_json::to_string_pretty(&trimmed).unwrap_or_else(|_| json.to_string())
        }
        _ => json.to_string(),
    }
}

fn trim_jsonl_file(path: &str, max_lines: usize) {
    if let Ok(content) = fs::read_to_string(path) {
        let lines: Vec<&str> = content
            .trim()
            .split('\n')
            .filter(|l| !l.trim().is_empty())
            .collect();
        if lines.len() > max_lines {
            let trimmed = lines[lines.len() - max_lines..].join("\n") + "\n";
            let _ = fs::write(path, trimmed);
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Unit tests (pure Rust — no Node.js runtime needed)
// ──────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn make_tmp() -> TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn test_project_hash_length() {
        let h = project_hash(".".to_string());
        assert_eq!(h.len(), 12, "hash must be 12 hex chars");
    }

    #[test]
    fn test_project_hash_deterministic() {
        assert_eq!(
            project_hash(".".to_string()),
            project_hash(".".to_string()),
            "hash must be deterministic"
        );
    }

    #[test]
    fn test_project_hash_differs_per_path() {
        let h1 = project_hash("/tmp".to_string());
        let h2 = project_hash("/usr".to_string());
        assert_ne!(h1, h2, "different paths must produce different hashes");
    }

    #[test]
    fn test_load_semantic_missing() {
        let tmp = make_tmp();
        let result = load_semantic(tmp.path().to_string_lossy().to_string());
        assert_eq!(result, "[]");
    }

    #[test]
    fn test_save_and_load_semantic() {
        let tmp = make_tmp();
        let dir = tmp.path().to_string_lossy().to_string();
        let json = r#"[{"id":"a","timestamp":1,"type":"fact","content":"test","tags":["x"]}]"#;
        save_semantic(dir.clone(), json.to_string()).unwrap();
        let loaded = load_semantic(dir);
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&loaded).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0]["content"], "test");
    }

    #[test]
    fn test_save_semantic_trims_to_500() {
        let tmp = make_tmp();
        let dir = tmp.path().to_string_lossy().to_string();
        let entries: Vec<serde_json::Value> = (0..600)
            .map(|i| {
                serde_json::json!({
                    "id": format!("e{}", i),
                    "timestamp": i,
                    "type": "fact",
                    "content": format!("entry {}", i),
                    "tags": []
                })
            })
            .collect();
        let json = serde_json::to_string(&entries).unwrap();
        save_semantic(dir.clone(), json).unwrap();
        let loaded: Vec<serde_json::Value> =
            serde_json::from_str(&load_semantic(dir)).unwrap();
        assert_eq!(loaded.len(), 500, "should trim to 500 entries");
        // Must keep the last 500 (most recent)
        assert_eq!(loaded[0]["timestamp"], 100, "first kept entry has timestamp 100");
    }

    #[test]
    fn test_load_working_missing() {
        let tmp = make_tmp();
        let result = load_working(tmp.path().to_string_lossy().to_string());
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert!(v["activeFiles"].is_array());
    }

    #[test]
    fn test_save_and_load_working() {
        let tmp = make_tmp();
        let dir = tmp.path().to_string_lossy().to_string();
        let state = r#"{"currentGoal":"write tests","activeFiles":["src/lib.rs"],"recentErrors":[],"discoveredPatterns":[]}"#;
        save_working(dir.clone(), state.to_string()).unwrap();
        let loaded = load_working(dir);
        let v: serde_json::Value = serde_json::from_str(&loaded).unwrap();
        assert_eq!(v["currentGoal"], "write tests");
    }

    #[test]
    fn test_append_and_load_episodes() {
        let tmp = make_tmp();
        let dir = tmp.path().to_string_lossy().to_string();
        for i in 0..5 {
            let ep = serde_json::json!({
                "id": format!("ep_{}", i),
                "timestamp": i,
                "summary": format!("session {}", i),
                "outcome": "success"
            });
            append_episode(dir.clone(), ep.to_string()).unwrap();
        }
        let loaded = load_episodes(dir, 5);
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&loaded).unwrap();
        assert_eq!(parsed.len(), 5);
        // File order: oldest first (session 0 at index 0)
        assert_eq!(parsed[0]["summary"], "session 0");
        assert_eq!(parsed[4]["summary"], "session 4");
    }

    #[test]
    fn test_episodes_trim_to_100() {
        let tmp = make_tmp();
        let dir = tmp.path().to_string_lossy().to_string();
        for i in 0..120 {
            let ep = serde_json::json!({
                "id": format!("ep_{}", i),
                "timestamp": i,
                "summary": format!("s{}", i),
                "outcome": "success"
            });
            append_episode(dir.clone(), ep.to_string()).unwrap();
        }
        // Count lines in the file
        let content = fs::read_to_string(format!("{}/episodes.jsonl", dir)).unwrap();
        let count = content.trim().split('\n').filter(|l| !l.is_empty()).count();
        assert_eq!(count, 100, "episodes.jsonl must be trimmed to 100 lines");
    }

    #[test]
    fn test_jaccard_identical() {
        let s = "TypeScript React hooks async patterns".to_string();
        assert_eq!(jaccard_similarity(s.clone(), s.clone()), 1.0);
    }

    #[test]
    fn test_jaccard_disjoint() {
        assert_eq!(
            jaccard_similarity("apple banana cherry".to_string(), "dog elephant fish".to_string()),
            0.0
        );
    }

    #[test]
    fn test_jaccard_partial() {
        let sim = jaccard_similarity(
            "TypeScript hooks patterns".to_string(),
            "hooks state patterns".to_string(),
        );
        assert!(sim > 0.0 && sim < 1.0);
    }

    #[test]
    fn test_jaccard_both_empty() {
        assert_eq!(jaccard_similarity("a".to_string(), "b".to_string()), 1.0); // short words filtered out → both empty
    }

    #[test]
    fn test_search_entries_empty_query() {
        let entries = serde_json::json!([
            {"id":"1","timestamp":1,"type":"fact","content":"hello world","tags":[]},
            {"id":"2","timestamp":2,"type":"fact","content":"foo bar","tags":[]}
        ]);
        let result = search_entries(entries.to_string(), "".to_string(), 10);
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed.len(), 2);
    }

    #[test]
    fn test_search_entries_finds_match() {
        let entries = serde_json::json!([
            {"id":"1","timestamp":1,"type":"fact","content":"TypeScript async patterns","tags":["typescript"]},
            {"id":"2","timestamp":2,"type":"fact","content":"Python data science","tags":["python"]},
            {"id":"3","timestamp":3,"type":"pattern","content":"React hooks best practices","tags":["react"]}
        ]);
        let result = search_entries(entries.to_string(), "TypeScript patterns".to_string(), 5);
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap();
        assert!(!parsed.is_empty());
        // TypeScript entry should score highest
        assert_eq!(parsed[0]["id"], "1");
    }

    #[test]
    fn test_search_entries_limit() {
        let entries: Vec<serde_json::Value> = (0..20)
            .map(|i| {
                serde_json::json!({
                    "id": format!("{}", i),
                    "timestamp": i,
                    "type": "fact",
                    "content": "matching keyword content here",
                    "tags": []
                })
            })
            .collect();
        let result = search_entries(
            serde_json::to_string(&entries).unwrap(),
            "keyword".to_string(),
            5,
        );
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed.len(), 5);
    }

    #[test]
    fn test_trim_json_array_str_noop_when_small() {
        let json = r#"[{"id":"1"},{"id":"2"}]"#;
        let trimmed = trim_json_array_str(json, 500);
        let orig: Vec<serde_json::Value> = serde_json::from_str(json).unwrap();
        let out: Vec<serde_json::Value> = serde_json::from_str(&trimmed).unwrap();
        assert_eq!(orig.len(), out.len());
    }

    #[test]
    fn test_trim_jsonl_file() {
        let tmp = make_tmp();
        let path = tmp.path().join("test.jsonl");
        let path_str = path.to_string_lossy().to_string();
        for i in 0..150 {
            fs::write(&path, {
                let mut s = String::new();
                for j in 0..=i {
                    s.push_str(&format!("{{\"n\":{}}}\n", j));
                }
                s
            })
            .unwrap();
        }
        trim_jsonl_file(&path_str, 50);
        let content = fs::read_to_string(&path).unwrap();
        let count = content.trim().split('\n').filter(|l| !l.is_empty()).count();
        assert_eq!(count, 50);
    }
}
