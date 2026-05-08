use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SemanticEntry {
    pub id: String,
    pub timestamp: i64,
    #[serde(rename = "type")]
    pub kind: String,
    pub content: String,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpisodicEntry {
    pub id: String,
    pub timestamp: i64,
    pub summary: String,
    pub outcome: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkingState {
    pub goals: Vec<String>,
    #[serde(rename = "activeFiles")]
    pub active_files: Vec<String>,
    #[serde(rename = "recentErrors")]
    pub recent_errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryStats {
    pub project_hash: String,
    pub semantic_count: usize,
    pub episode_count: usize,
    pub working_goals: usize,
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn project_hash_inner(project_path: &str) -> String {
    let canonical = fs::canonicalize(project_path)
        .unwrap_or_else(|_| PathBuf::from(project_path));
    let mut hasher = Sha256::new();
    hasher.update(canonical.to_string_lossy().as_bytes());
    let result = hasher.finalize();
    hex::encode(result)[..12].to_string()
}

fn memory_dir(project_path: &str) -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let hash = project_hash_inner(project_path);
    format!("{}/.timps/memory/{}", home, hash)
}

// ── Tauri Commands ─────────────────────────────────────────────────────────

/// Get the 12-char project hash for a given path
#[tauri::command]
pub fn project_hash(project_path: String) -> String {
    project_hash_inner(&project_path)
}

/// Load all semantic memory entries for a project
#[tauri::command]
pub fn load_semantic(project_path: String) -> Result<Vec<SemanticEntry>, String> {
    let dir = memory_dir(&project_path);
    let p = format!("{}/semantic.json", dir);
    match fs::read_to_string(&p) {
        Ok(s) => serde_json::from_str(&s).map_err(|e| e.to_string()),
        Err(_) => Ok(vec![]),
    }
}

/// Load the last `count` episodic entries for a project (file order, oldest first in window)
#[tauri::command]
pub fn load_episodes(project_path: String, count: u32) -> Result<Vec<EpisodicEntry>, String> {
    let dir = memory_dir(&project_path);
    let p = format!("{}/episodes.jsonl", dir);
    let file = match fs::File::open(&p) {
        Ok(f) => f,
        Err(_) => return Ok(vec![]),
    };
    let lines: Vec<String> = BufReader::new(file)
        .lines()
        .filter_map(|l| l.ok())
        .filter(|l| !l.trim().is_empty())
        .collect();

    let count_usize = count as usize;
    let start = lines.len().saturating_sub(count_usize);
    let entries: Vec<EpisodicEntry> = lines[start..]
        .iter()
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect();
    Ok(entries)
}

/// Load working memory state for a project
#[tauri::command]
pub fn load_working(project_path: String) -> Result<WorkingState, String> {
    let dir = memory_dir(&project_path);
    let p = format!("{}/working.json", dir);
    match fs::read_to_string(&p) {
        Ok(s) => serde_json::from_str(&s).map_err(|e| e.to_string()),
        Err(_) => Ok(WorkingState {
            goals: vec![],
            active_files: vec![],
            recent_errors: vec![],
        }),
    }
}

/// Get aggregate stats for a project's memory
#[tauri::command]
pub fn get_memory_stats(project_path: String) -> Result<MemoryStats, String> {
    let dir = memory_dir(&project_path);

    let semantic_count = {
        let p = format!("{}/semantic.json", dir);
        match fs::read_to_string(&p) {
            Ok(s) => {
                let v: Vec<serde_json::Value> = serde_json::from_str(&s).unwrap_or_default();
                v.len()
            }
            Err(_) => 0,
        }
    };

    let episode_count = {
        let p = format!("{}/episodes.jsonl", dir);
        match fs::File::open(&p) {
            Ok(f) => BufReader::new(f)
                .lines()
                .filter(|l| l.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false))
                .count(),
            Err(_) => 0,
        }
    };

    let working_goals = {
        let p = format!("{}/working.json", dir);
        match fs::read_to_string(&p) {
            Ok(s) => {
                let v: serde_json::Value = serde_json::from_str(&s).unwrap_or(serde_json::json!({}));
                v["goals"].as_array().map(|a| a.len()).unwrap_or(0)
            }
            Err(_) => 0,
        }
    };

    Ok(MemoryStats {
        project_hash: project_hash_inner(&project_path),
        semantic_count,
        episode_count,
        working_goals,
    })
}

/// List all known project hashes (directories under ~/.timps/memory/)
#[tauri::command]
pub fn list_projects() -> Result<Vec<String>, String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let base = format!("{}/.timps/memory", home);
    match fs::read_dir(&base) {
        Ok(entries) => {
            let hashes: Vec<String> = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().map(|ft| ft.is_dir()).unwrap_or(false))
                .map(|e| e.file_name().to_string_lossy().to_string())
                .collect();
            Ok(hashes)
        }
        Err(_) => Ok(vec![]),
    }
}

/// Simple semantic search: returns entries whose content/tags contain all query words
#[tauri::command]
pub fn search_memory(project_path: String, query: String, limit: u32) -> Result<Vec<SemanticEntry>, String> {
    let entries = load_semantic(project_path)?;
    if query.trim().is_empty() {
        let n = limit as usize;
        return Ok(entries.into_iter().take(n).collect());
    }

    let words: Vec<String> = query
        .to_lowercase()
        .split_whitespace()
        .filter(|w| w.len() > 2)
        .map(|w| w.to_string())
        .collect();

    let mut scored: Vec<(f64, SemanticEntry)> = entries
        .into_iter()
        .filter_map(|e| {
            let haystack = format!(
                "{} {}",
                e.content.to_lowercase(),
                e.tags.join(" ").to_lowercase()
            );
            let score: f64 = words
                .iter()
                .map(|w| if haystack.contains(w.as_str()) { 1.0 } else { 0.0 })
                .sum();
            if score > 0.0 { Some((score, e)) } else { None }
        })
        .collect();

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    let n = limit as usize;
    Ok(scored.into_iter().take(n).map(|(_, e)| e).collect())
}

/// Store a new semantic memory entry (used by ChatPage "save as memory" action)
#[tauri::command]
pub fn store_memory(
    project_path: String,
    key: String,
    value: String,
    importance: f64,
    tags: Vec<String>,
) -> Result<(), String> {
    let dir = memory_dir(&project_path);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let p = format!("{}/semantic.json", dir);
    let mut entries: Vec<SemanticEntry> = match fs::read_to_string(&p) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => vec![],
    };
    // Upsert by key
    entries.retain(|e| e.id != key);
    entries.push(SemanticEntry {
        id: key,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64,
        kind: "fact".to_string(),
        content: value,
        tags,
        score: Some(importance),
    });
    let s = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    fs::write(&p, s).map_err(|e| e.to_string())
}

/// Delete a semantic memory entry by key
#[tauri::command]
pub fn delete_memory(project_path: String, key: String) -> Result<usize, String> {
    let dir = memory_dir(&project_path);
    let p = format!("{}/semantic.json", dir);
    let mut entries: Vec<SemanticEntry> = match fs::read_to_string(&p) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => return Ok(0),
    };
    let before = entries.len();
    entries.retain(|e| e.id != key);
    let s = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    fs::write(&p, s).map_err(|e| e.to_string())?;
    Ok(before - entries.len())
}

/// Chat with the TIMPS server (requires timps-server running at http://localhost:3000)
#[tauri::command]
pub async fn chat(
    prompt: String,
    project_path: Option<String>,
    provider: Option<String>,
) -> Result<String, String> {
    let url = std::env::var("TIMPS_SERVER_URL")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());
    let body = serde_json::json!({
        "prompt": prompt,
        "provider": provider,
        "project_path": project_path,
    });
    let resp = reqwest::Client::new()
        .post(format!("{url}/chat"))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if resp.status().is_success() {
        let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(j["output"].as_str().unwrap_or("").to_string())
    } else {
        Err(format!("Server error: {}", resp.status()))
    }
}

/// Get the current TIMPS version
#[tauri::command]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get the current LLM provider
#[tauri::command]
pub fn get_provider() -> String {
    std::env::var("TIMPS_PROVIDER").unwrap_or_else(|_| "ollama".to_string())
}

/// Set the LLM provider
#[tauri::command]
pub fn set_provider(provider: String) -> Result<(), String> {
    std::env::set_var("TIMPS_PROVIDER", &provider);
    Ok(())
}

/// Install update (placeholder for auto-updater)
#[tauri::command]
pub fn install_update() -> Result<(), String> {
    Err("Auto-updater not yet configured. Check GitHub Releases for updates.".to_string())
}
