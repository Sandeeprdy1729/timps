use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader, Write};

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KnowledgeNode {
    pub id: String,
    pub entity: String,
    #[serde(rename = "entityType")]
    pub entity_type: String,
    pub attributes: serde_json::Value,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KnowledgeEdge {
    pub id: String,
    pub subject: String,
    pub relation: String,
    pub object: String,
    pub weight: f64,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KnowledgeGraph {
    pub nodes: Vec<KnowledgeNode>,
    pub edges: Vec<KnowledgeEdge>,
}

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

fn to_base36(mut n: u32) -> String {
    const DIGITS: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if n == 0 { return "0".to_string(); }
    let mut result = Vec::new();
    while n > 0 {
        result.push(DIGITS[(n % 36) as usize]);
        n /= 36;
    }
    result.reverse();
    String::from_utf8(result).unwrap()
}

fn project_hash_inner(project_path: &str) -> String {
    let mut h: i32 = 0;
    for b in project_path.bytes() {
        h = h.wrapping_mul(31).wrapping_add(b as i32);
    }
    to_base36(h.unsigned_abs())
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

/// Load the knowledge graph (nodes + edges) for a project
#[tauri::command]
pub fn load_knowledge_graph(project_path: String) -> Result<KnowledgeGraph, String> {
    let dir = memory_dir(&project_path);
    let p = format!("{}/knowledge-graph.json", dir);
    match fs::read_to_string(&p) {
        Ok(s) => serde_json::from_str(&s).map_err(|e| e.to_string()),
        Err(_) => Ok(KnowledgeGraph { nodes: vec![], edges: vec![] }),
    }
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

/// Chat directly with Ollama (no proxy server needed).
/// Emits the full response via "chat:done" event (streaming TBD).
#[tauri::command]
pub async fn chat(
    app: tauri::AppHandle,
    prompt: String,
    model: Option<String>,
    _project_path: Option<String>,
) -> Result<(), String> {
    use tauri::Emitter;

    let ollama_url = std::env::var("OLLAMA_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());
    let model = model.unwrap_or_else(|| "llama3.2:1b".to_string());

    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": false,
        "options": { "num_ctx": 32768 }
    });

    let client = reqwest::Client::new();
    let resp = match client
        .post(format!("{}/api/chat", ollama_url))
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => {
            let msg = format!("Cannot reach Ollama at {ollama_url}. Is it running? (ollama serve)");
            let _ = app.emit("chat:error", serde_json::json!({ "message": msg }));
            return Err(msg);
        }
    };

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        let msg = format!("Ollama {status}: {text}");
        let _ = app.emit("chat:error", serde_json::json!({ "message": msg }));
        return Err(msg);
    }

    let j: serde_json::Value = resp.json().await.map_err(|e| {
        let msg = format!("Failed to parse Ollama response: {e}");
        let _ = app.emit("chat:error", serde_json::json!({ "message": msg }));
        msg
    })?;

    let text = j["message"]["content"].as_str().unwrap_or("").to_string();
    let input_tokens = j["prompt_eval_count"].as_u64().unwrap_or(0) as u32;
    let output_tokens = j["eval_count"].as_u64().unwrap_or(0) as u32;

    let _ = app.emit("chat:done", serde_json::json!({
        "text": text,
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
    }));
    Ok(())
}

/// List models available in Ollama
#[tauri::command]
pub async fn list_ollama_models() -> Result<Vec<String>, String> {
    let ollama_url = std::env::var("OLLAMA_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/api/tags", ollama_url))
        .send()
        .await
        .map_err(|e| format!("Cannot reach Ollama: {}", e))?;
    if !resp.status().is_success() {
        return Ok(vec![]);
    }
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let models = j["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    Ok(models)
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

// ── Passive Background Learning Commands ──────────────────────────────────

/// Domain tags inferred from content for passive observations
fn infer_domain(content: &str) -> &'static str {
    let lc = content.to_lowercase();
    if ["overwork", "exhausted", "stress", "burnout", "tired", "deadline", "overwhelm"]
        .iter()
        .any(|k| lc.contains(k))
    {
        return "burnout";
    }
    if ["colleague", "conflict", "team", "manager", "feedback", "friction"]
        .iter()
        .any(|k| lc.contains(k))
    {
        return "relationship";
    }
    if lc.contains("bug") || lc.contains("error") || lc.contains("fix") || lc.contains("code") {
        return "code_pattern";
    }
    if lc.contains("decide") || lc.contains("decision") || lc.contains("choose") {
        return "decision";
    }
    if lc.contains("goal") || lc.contains("plan") || lc.contains("target") {
        return "goal";
    }
    "general"
}

/// Store a passive background observation into semantic memory.
///
/// Called by the passive listener in the frontend whenever the user sends
/// a message. Content is automatically deduplicated and domain-tagged.
#[tauri::command]
pub fn passive_store(
    project_path: String,
    content: String,
    kind: Option<String>,
    tags: Vec<String>,
) -> Result<String, String> {
    if content.trim().len() < 10 {
        return Ok("skip:too_short".to_string());
    }

    let dir = memory_dir(&project_path);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let p = format!("{}/semantic.json", dir);

    let mut entries: Vec<SemanticEntry> = match fs::read_to_string(&p) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => vec![],
    };

    // Simple dedup: skip if exact content already stored
    let lc_new = content.to_lowercase();
    if entries.iter().any(|e| e.content.to_lowercase() == lc_new) {
        return Ok("skip:duplicate".to_string());
    }

    let domain = infer_domain(&content);
    let id = format!(
        "obs_{}_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        &lc_new[..lc_new.len().min(8)].replace(' ', "_")
    );

    let mut all_tags = tags;
    all_tags.push("passive".to_string());
    all_tags.push(domain.to_string());
    all_tags.dedup();

    entries.push(SemanticEntry {
        id: id.clone(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64,
        kind: kind.unwrap_or_else(|| "observation".to_string()),
        content,
        tags: all_tags,
        score: Some(0.7),
    });

    // Keep most recent 2000 entries
    if entries.len() > 2000 {
        let drain_to = entries.len() - 2000;
        entries.drain(0..drain_to);
    }

    let s = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    fs::write(&p, s).map_err(|e| e.to_string())?;
    Ok(id)
}

/// Store an episodic memory (conversation summary) from the desktop app.
#[tauri::command]
pub fn store_episode(
    project_path: String,
    summary: String,
    outcome: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let dir = memory_dir(&project_path);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let p = format!("{}/episodes.jsonl", dir);

    let id = format!(
        "ep_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    );
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let entry = serde_json::json!({
        "id": id,
        "timestamp": ts,
        "summary": summary,
        "outcome": outcome,
        "tags": tags,
    });

    let line = format!("{}\n", serde_json::to_string(&entry).map_err(|e| e.to_string())?);
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&p)
        .map_err(|e| e.to_string())?;
    file.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Autostart commands ─────────────────────────────────────────────────────

/// Enable launch-at-login (autostart) using tauri-plugin-autostart
#[tauri::command]
pub fn enable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().enable().map_err(|e| e.to_string())
}

/// Disable launch-at-login
#[tauri::command]
pub fn disable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().disable().map_err(|e| e.to_string())
}

/// Returns true if launch-at-login is enabled
#[tauri::command]
pub fn is_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

// ── Clipboard watcher ──────────────────────────────────────────────────────

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

static CLIPBOARD_WATCHER_RUNNING: std::sync::OnceLock<Arc<AtomicBool>> = std::sync::OnceLock::new();

/// Start watching the clipboard (opt-in). Captures copied text into passive memory.
/// Each clip must be ≥20 chars and differ from the previous clip to be stored.
#[tauri::command]
pub fn start_clipboard_watcher(app: tauri::AppHandle, project_path: String) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;

    let flag = CLIPBOARD_WATCHER_RUNNING.get_or_init(|| Arc::new(AtomicBool::new(false)));

    if flag.load(Ordering::SeqCst) {
        return Ok(()); // already running
    }
    flag.store(true, Ordering::SeqCst);

    let flag_clone = Arc::clone(flag);
    let app_clone = app.clone();
    let path_clone = project_path.clone();

    std::thread::spawn(move || {
        use tauri::Emitter;
        let mut last_clip = String::new();
        // Poll fast for URL detection; throttle passive-store to every ~3 seconds
        let mut passive_ticks: u32 = 0;
        while flag_clone.load(Ordering::SeqCst) {
            std::thread::sleep(std::time::Duration::from_millis(500));
            passive_ticks += 1;

            let text = match app_clone.clipboard().read_text() {
                Ok(t) => t,
                Err(_) => continue,
            };

            let trimmed = text.trim().to_string();
            if trimmed.is_empty() || trimmed == last_clip {
                continue;
            }
            last_clip = trimmed.clone();

            // ── URL fast-path: emit event + save to lens queue ──────────
            let link_type = detect_link_type_inner(&trimmed);
            if link_type != "other" {
                let _ = app_clone.emit(
                    "timps:url-detected",
                    serde_json::json!({ "url": trimmed, "link_type": link_type }),
                );
                let _ = save_lens_link(&trimmed, link_type, None);
                continue; // don't also dump URLs into passive memory
            }

            // ── Regular text — only passive-store every ~3 seconds ──────
            if passive_ticks % 6 == 0 && trimmed.len() >= 20 {
                let _ = passive_store(
                    path_clone.clone(),
                    trimmed,
                    Some("clipboard".to_string()),
                    vec!["clipboard".to_string()],
                );
            }
        }
    });

    Ok(())
}

/// Stop the clipboard watcher
#[tauri::command]
pub fn stop_clipboard_watcher() -> Result<(), String> {
    if let Some(flag) = CLIPBOARD_WATCHER_RUNNING.get() {
        flag.store(false, Ordering::SeqCst);
    }
    Ok(())
}

// ── Background summarizer ──────────────────────────────────────────────────

/// Run a lightweight background pass that turns recent episodes into semantic facts.
/// Called automatically on a timer from the frontend (every 30 min when idle).
#[tauri::command]
pub fn run_background_summarizer(project_path: String) -> Result<usize, String> {
    let dir = memory_dir(&project_path);
    let ep_path = format!("{}/episodes.jsonl", dir);

    let file = match fs::File::open(&ep_path) {
        Ok(f) => f,
        Err(_) => return Ok(0),
    };

    // Read all episodes
    let episodes: Vec<serde_json::Value> = BufReader::new(file)
        .lines()
        .filter_map(|l| l.ok())
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str(&l).ok())
        .collect();

    if episodes.is_empty() {
        return Ok(0);
    }

    // Load existing semantic entries to avoid re-adding synthesized facts
    let sem_path = format!("{}/semantic.json", dir);
    let mut sem_entries: Vec<SemanticEntry> = match fs::read_to_string(&sem_path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => vec![],
    };
    let existing_synthesized: std::collections::HashSet<String> = sem_entries
        .iter()
        .filter(|e| e.tags.contains(&"synthesized".to_string()))
        .map(|e| e.content.clone())
        .collect();

    // Keyword-based pattern extraction from episode summaries
    let mut new_facts: Vec<String> = Vec::new();

    let summaries: Vec<String> = episodes
        .iter()
        .filter_map(|e| e["summary"].as_str().map(|s| s.to_string()))
        .collect();

    // Count recurring words (≥4 chars) as patterns
    let mut word_freq: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for summary in &summaries {
        for word in summary.split_whitespace() {
            let w = word.to_lowercase().trim_matches(|c: char| !c.is_alphanumeric()).to_string();
            if w.len() >= 4 {
                *word_freq.entry(w).or_insert(0) += 1;
            }
        }
    }

    // Words appearing ≥3 times across episodes → infer a pattern
    let mut patterns: Vec<String> = word_freq
        .into_iter()
        .filter(|(_, count)| *count >= 3)
        .map(|(word, count)| format!("Recurring topic in {} sessions: '{}'", count, word))
        .collect();
    patterns.sort();
    new_facts.extend(patterns);

    // Extract goal-like sentences (contain "want", "need", "should", "will", "plan")
    let goal_keywords = ["want to", "need to", "should", "will ", "plan to", "going to"];
    for summary in &summaries {
        for kw in &goal_keywords {
            if summary.to_lowercase().contains(kw) && summary.len() >= 20 {
                new_facts.push(format!("Inferred goal: {}", summary.trim()));
                break;
            }
        }
    }

    // Deduplicate and filter already stored
    new_facts.sort();
    new_facts.dedup();

    let mut added = 0usize;
    let now_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    for fact in new_facts {
        if existing_synthesized.contains(&fact) {
            continue;
        }
        if fact.trim().len() < 15 {
            continue;
        }
        let id = format!("synth_{}_{}", now_ts, added);
        sem_entries.push(SemanticEntry {
            id,
            timestamp: now_ts,
            kind: "pattern".to_string(),
            content: fact,
            tags: vec!["synthesized".to_string(), "background".to_string()],
            score: Some(0.8),
        });
        added += 1;
    }

    if added > 0 {
        // Keep most recent 2000
        if sem_entries.len() > 2000 {
            let drain = sem_entries.len() - 2000;
            sem_entries.drain(0..drain);
        }
        let s = serde_json::to_string_pretty(&sem_entries).map_err(|e| e.to_string())?;
        fs::write(&sem_path, s).map_err(|e| e.to_string())?;
    }

    Ok(added)
}

// ── Proactive notifications ────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct NotificationItem {
    pub title: String,
    pub body: String,
    pub kind: String,
}

/// Scan memory for patterns worth surfacing as a tray notification.
/// Returns a list of notifications; the frontend sends the OS notification.
#[tauri::command]
pub fn check_proactive_notifications(project_path: String) -> Result<Vec<NotificationItem>, String> {
    let dir = memory_dir(&project_path);
    let mut notifications = Vec::new();

    // 1. Repeated errors in recent episodes
    let ep_path = format!("{}/episodes.jsonl", dir);
    if let Ok(file) = fs::File::open(&ep_path) {
        let recent_episodes: Vec<serde_json::Value> = BufReader::new(file)
            .lines()
            .filter_map(|l| l.ok())
            .filter(|l| !l.trim().is_empty())
            .filter_map(|l| serde_json::from_str(&l).ok())
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .take(20)
            .collect();

        // Count outcome "error" in last 20
        let error_count = recent_episodes
            .iter()
            .filter(|e| e["outcome"].as_str().unwrap_or("") == "error")
            .count();

        if error_count >= 3 {
            notifications.push(NotificationItem {
                title: "Repeated Errors Detected".to_string(),
                body: format!("{} recent sessions ended with errors. Check your memory for patterns.", error_count),
                kind: "repeated_error".to_string(),
            });
        }

        // Check for unresolved goals (summaries containing "TODO" or "fix" or "remember")
        let unresolved: Vec<String> = recent_episodes
            .iter()
            .filter_map(|e| e["summary"].as_str().map(|s| s.to_string()))
            .filter(|s| {
                let lower = s.to_lowercase();
                lower.contains("todo") || lower.contains("remember to") || lower.contains("don't forget")
            })
            .take(3)
            .collect();

        if !unresolved.is_empty() {
            notifications.push(NotificationItem {
                title: "Unresolved Items Found".to_string(),
                body: format!("You have {} items to follow up on from recent sessions.", unresolved.len()),
                kind: "unresolved_task".to_string(),
            });
        }
    }

    // 2. Memory size milestone
    let sem_path = format!("{}/semantic.json", dir);
    if let Ok(s) = fs::read_to_string(&sem_path) {
        let entries: Vec<serde_json::Value> = serde_json::from_str(&s).unwrap_or_default();
        let milestones = [100, 500, 1000, 2000];
        if milestones.contains(&entries.len()) {
            notifications.push(NotificationItem {
                title: "Memory Milestone!".to_string(),
                body: format!("TIMPS has learned {} facts about your work.", entries.len()),
                kind: "milestone".to_string(),
            });
        }
    }

    Ok(notifications)
}

// ── TIMPS Lens — frictionless link analysis ────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LensLink {
    pub id: String,
    pub url: String,
    pub link_type: String,
    pub title: Option<String>,
    pub timestamp: i64,
    pub analyzed: bool,
    pub analysis: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubMeta {
    pub full_name: String,
    pub description: Option<String>,
    pub stars: u64,
    pub forks: u64,
    pub language: Option<String>,
    pub open_issues: u64,
    pub topics: Vec<String>,
    pub updated_at: String,
    pub default_branch: String,
    pub license: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HuggingFaceMeta {
    pub model_id: String,
    pub author: Option<String>,
    pub downloads: Option<u64>,
    pub likes: Option<u64>,
    pub tags: Vec<String>,
    pub pipeline_tag: Option<String>,
    pub library_name: Option<String>,
}

pub fn detect_link_type_inner(url: &str) -> &'static str {
    let trimmed = url.trim();
    if trimmed.contains("github.com/") {
        "github"
    } else if trimmed.contains("huggingface.co/") {
        "huggingface"
    } else {
        "other"
    }
}

fn lens_dir() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    format!("{}/.timps/lens", home)
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

fn epoch_secs_to_date(secs: u64) -> String {
    let mut days = (secs / 86400) as i64;
    let mut year = 1970i32;
    loop {
        let days_in_year = if is_leap_year(year) { 366i64 } else { 365i64 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }
    let month_days: [i64; 12] = [
        31,
        if is_leap_year(year) { 29 } else { 28 },
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];
    let mut month = 1i32;
    for &dm in &month_days {
        if days < dm {
            break;
        }
        days -= dm;
        month += 1;
    }
    format!("{:04}-{:02}-{:02}", year, month, days + 1)
}

fn today_queue_path() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let date = epoch_secs_to_date(secs);
    format!("{}/{}.jsonl", lens_dir(), date)
}

fn save_lens_link(url: &str, link_type: &str, title: Option<String>) -> Result<String, String> {
    let dir = lens_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = today_queue_path();

    // Deduplicate by URL within today's file
    if let Ok(existing) = fs::read_to_string(&path) {
        for line in existing.lines() {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                if v["url"].as_str() == Some(url) {
                    return Ok(v["id"].as_str().unwrap_or("").to_string());
                }
            }
        }
    }

    let id = format!(
        "lens_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let entry = serde_json::json!({
        "id": id,
        "url": url,
        "link_type": link_type,
        "title": title,
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64,
        "analyzed": false,
        "analysis": null,
    });

    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "{}", serde_json::to_string(&entry).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;

    Ok(id)
}

/// Detect the link type of a URL: "github" | "huggingface" | "other"
#[tauri::command]
pub fn detect_link_type(url: String) -> String {
    detect_link_type_inner(&url).to_string()
}

/// Save a link to today's Lens queue (~/.timps/lens/YYYY-MM-DD.jsonl)
#[tauri::command]
pub fn save_to_lens_queue(url: String, link_type: String, title: Option<String>) -> Result<String, String> {
    save_lens_link(&url, &link_type, title)
}

/// Get all links in today's Lens queue
#[tauri::command]
pub fn get_lens_queue() -> Result<Vec<LensLink>, String> {
    let path = today_queue_path();
    match fs::read_to_string(&path) {
        Ok(s) => Ok(
            s.lines()
                .filter(|l| !l.trim().is_empty())
                .filter_map(|l| serde_json::from_str(l).ok())
                .collect(),
        ),
        Err(_) => Ok(vec![]),
    }
}

/// Remove a link from today's Lens queue by id
#[tauri::command]
pub fn remove_from_lens_queue(id: String) -> Result<(), String> {
    let path = today_queue_path();
    let content = fs::read_to_string(&path).unwrap_or_default();
    let filtered: String = content
        .lines()
        .filter(|l| {
            serde_json::from_str::<serde_json::Value>(l)
                .map(|v| v["id"].as_str() != Some(&id))
                .unwrap_or(true)
        })
        .map(|l| format!("{}\n", l))
        .collect();
    fs::write(&path, filtered).map_err(|e| e.to_string())
}

/// Persist analysis result for a queued link
#[tauri::command]
pub fn mark_lens_analyzed(id: String, analysis: String) -> Result<(), String> {
    let path = today_queue_path();
    let content = fs::read_to_string(&path).unwrap_or_default();
    let updated: String = content
        .lines()
        .map(|l| {
            if let Ok(mut v) = serde_json::from_str::<serde_json::Value>(l) {
                if v["id"].as_str() == Some(&id) {
                    v["analyzed"] = serde_json::json!(true);
                    v["analysis"] = serde_json::json!(analysis);
                    return serde_json::to_string(&v).unwrap_or_else(|_| l.to_string());
                }
            }
            l.to_string()
        })
        .map(|l| format!("{}\n", l))
        .collect();
    fs::write(&path, updated).map_err(|e| e.to_string())
}

/// Return links from the last `days` daily queue files (for history view)
#[tauri::command]
pub fn get_lens_history(days: u32) -> Result<Vec<LensLink>, String> {
    use std::cmp::Reverse;
    let dir = lens_dir();
    let mut all: Vec<LensLink> = vec![];
    if let Ok(entries) = fs::read_dir(&dir) {
        let mut files: Vec<_> = entries
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext == "jsonl")
                    .unwrap_or(false)
            })
            .collect();
        files.sort_by_key(|e| Reverse(e.file_name()));
        for entry in files.into_iter().take(days as usize) {
            if let Ok(s) = fs::read_to_string(entry.path()) {
                let links: Vec<LensLink> = s
                    .lines()
                    .filter(|l| !l.trim().is_empty())
                    .filter_map(|l| serde_json::from_str(l).ok())
                    .collect();
                all.extend(links);
            }
        }
    }
    Ok(all)
}

/// Fetch GitHub repo metadata via the public REST API.
/// Reads GITHUB_TOKEN env var when available (raises rate limit from 60 to 5000 req/hr).
#[tauri::command]
pub async fn fetch_github_meta(url: String) -> Result<GitHubMeta, String> {
    // Parse owner/repo from e.g. https://github.com/owner/repo(/anything)
    let stripped = url
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_start_matches("github.com/");

    let parts: Vec<&str> = stripped.splitn(3, '/').collect();
    if parts.len() < 2 || parts[0].is_empty() || parts[1].is_empty() {
        return Err("Invalid GitHub URL — expected https://github.com/owner/repo".to_string());
    }
    let owner = parts[0];
    let repo = parts[1]
        .split('#')
        .next()
        .unwrap_or(parts[1])
        .split('?')
        .next()
        .unwrap_or(parts[1]);

    let api_url = format!("https://api.github.com/repos/{}/{}", owner, repo);
    let client = reqwest::Client::builder()
        .user_agent("TIMPS-Desktop/0.1 (github.com/Sandeeprdy1729/timps)")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(&api_url);
    if let Ok(token) = std::env::var("GITHUB_TOKEN") {
        if !token.is_empty() {
            req = req.bearer_auth(token);
        }
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    if resp.status() == 404 {
        return Err(format!("Repo not found: {}/{}", owner, repo));
    }
    if !resp.status().is_success() {
        return Err(format!("GitHub API error {}: {}", resp.status(), resp.text().await.unwrap_or_default()));
    }

    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    Ok(GitHubMeta {
        full_name: j["full_name"].as_str().unwrap_or("").to_string(),
        description: j["description"].as_str().map(|s| s.to_string()),
        stars: j["stargazers_count"].as_u64().unwrap_or(0),
        forks: j["forks_count"].as_u64().unwrap_or(0),
        language: j["language"].as_str().map(|s| s.to_string()),
        open_issues: j["open_issues_count"].as_u64().unwrap_or(0),
        topics: j["topics"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
        updated_at: j["updated_at"].as_str().unwrap_or("").to_string(),
        default_branch: j["default_branch"].as_str().unwrap_or("main").to_string(),
        license: j["license"]["spdx_id"]
            .as_str()
            .filter(|s| *s != "NOASSERTION")
            .map(|s| s.to_string()),
    })
}

/// Fetch HuggingFace model metadata via the public API.
/// Reads HF_TOKEN env var when available.
#[tauri::command]
pub async fn fetch_hf_meta(url: String) -> Result<HuggingFaceMeta, String> {
    // Parse model_id from https://huggingface.co/owner/model(/anything)
    let stripped = url
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_start_matches("huggingface.co/");

    let parts: Vec<&str> = stripped.splitn(3, '/').collect();
    if parts.len() < 2 || parts[0].is_empty() || parts[1].is_empty() {
        return Err("Invalid HuggingFace URL — expected https://huggingface.co/owner/model".to_string());
    }
    let author = parts[0];
    let model_slug = parts[1].split('?').next().unwrap_or(parts[1]);
    let model_id = format!("{}/{}", author, model_slug);

    let api_url = format!("https://huggingface.co/api/models/{}", model_id);
    let client = reqwest::Client::builder()
        .user_agent("TIMPS-Desktop/0.1")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(&api_url);
    if let Ok(token) = std::env::var("HF_TOKEN") {
        if !token.is_empty() {
            req = req.bearer_auth(token);
        }
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HuggingFace API error {}", resp.status()));
    }

    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    Ok(HuggingFaceMeta {
        model_id: j["modelId"]
            .as_str()
            .or(j["id"].as_str())
            .unwrap_or(&model_id)
            .to_string(),
        author: j["author"].as_str().map(|s| s.to_string()),
        downloads: j["downloads"].as_u64(),
        likes: j["likes"].as_u64(),
        tags: j["tags"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .take(15)
                    .collect()
            })
            .unwrap_or_default(),
        pipeline_tag: j["pipeline_tag"].as_str().map(|s| s.to_string()),
        library_name: j["library_name"].as_str().map(|s| s.to_string()),
    })
}

/// Analyze a link using the TIMPS server LLM. Returns the analysis text.
/// `metadata_json` is a pre-serialized JSON string of GitHubMeta or HuggingFaceMeta.
#[tauri::command]
pub async fn analyze_lens_link(
    url: String,
    link_type: String,
    metadata_json: String,
    extra_prompt: Option<String>,
) -> Result<String, String> {
    let type_label = if link_type == "github" {
        "GitHub repository"
    } else {
        "HuggingFace model"
    };

    let base_prompt = if link_type == "github" {
        format!(
            "You are a senior software engineer reviewing a {}.\n\nURL: {}\nMetadata:\n{}\n\n\
            Please provide a concise analysis covering:\n\
            1. What this project does (1-2 sentences)\n\
            2. Strengths (2-3 bullet points)\n\
            3. Specific improvement suggestions (3-5 actionable bullet points)\n\
            4. Missing features or common patterns that would make this more robust\n\
            5. One key insight or architectural recommendation\n\
            Be specific and practical, not generic.",
            type_label, url, metadata_json
        )
    } else {
        format!(
            "You are an ML engineer reviewing a {}.\n\nURL: {}\nMetadata:\n{}\n\n\
            Please provide a concise analysis covering:\n\
            1. What this model does and its use case (1-2 sentences)\n\
            2. Strengths and notable characteristics\n\
            3. Potential improvements or fine-tuning suggestions\n\
            4. Best use cases and limitations\n\
            5. How to integrate this model effectively\n\
            Be specific and practical.",
            type_label, url, metadata_json
        )
    };

    let prompt = if let Some(extra) = extra_prompt {
        format!("{}\n\nAdditional context from user: {}", base_prompt, extra)
    } else {
        base_prompt
    };

    let server_url = std::env::var("TIMPS_SERVER_URL")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());

    let body = serde_json::json!({
        "prompt": prompt,
        "provider": null,
        "project_path": null,
    });

    let resp = reqwest::Client::new()
        .post(format!("{}/chat", server_url))
        .json(&body)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| format!("TIMPS server unreachable: {}. Start it with: cd timps-code && npm run dev", e))?;

    if resp.status().is_success() {
        let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(j["output"].as_str().unwrap_or("No response").to_string())
    } else {
        Err(format!("Server error {}: {}", resp.status(), resp.text().await.unwrap_or_default()))
    }
}

/// Auto-detect a project path by scanning common locations for project markers.
/// Checks: Desktop, Documents, Home, CWD. Looks for .git, package.json, Cargo.toml.
#[tauri::command]
pub fn detect_project_path() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let candidates = vec![
        format!("{}/Desktop", home),
        format!("{}/Documents", home),
        home.clone(),
    ];

    // Try common locations for a directory with project markers
    for base in &candidates {
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() { continue; }
                // Skip hidden dirs, node_modules, .timps
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if name.starts_with('.') || name == "node_modules" || name == "target" || name == ".timps" {
                    continue;
                }
                // Check for project markers
                for marker in &[".git", "package.json", "Cargo.toml", "go.mod", "pyproject.toml"] {
                    if path.join(marker).exists() {
                        return path.to_string_lossy().to_string();
                    }
                }
            }
        }
    }

    // Fallback: check if CWD has a project marker
    if let Ok(cwd) = std::env::current_dir() {
        for marker in &[".git", "package.json", "Cargo.toml"] {
            if cwd.join(marker).exists() {
                return cwd.to_string_lossy().to_string();
            }
        }
    }

    // Last resort: return Desktop
    format!("{}/Desktop", home)
}
