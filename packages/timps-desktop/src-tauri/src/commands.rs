use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::sync::Mutex;

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

pub(crate) fn project_hash_inner(project_path: &str) -> String {
    let path = Path::new(project_path);
    let normalized = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir().unwrap_or_default().join(path)
    };
    let path_str = normalized.to_string_lossy();
    let mut hasher = Sha256::new();
    hasher.update(path_str.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..6]) // first 6 bytes = 12 hex chars
}

pub(crate) fn home_dir() -> String {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string())
}

fn memory_dir(project_path: &str) -> String {
    let home = home_dir();
    let hash = project_hash_inner(project_path);
    format!("{}/.timps/memory/{}", home, hash)
}

/// Serializes read-modify-write cycles on semantic.json to prevent data loss
/// from concurrent access (clipboard watcher thread + Tauri commands).
static SEMANTIC_LOCK: Mutex<()> = Mutex::new(());

/// Write JSON data to a file atomically: write to a temp file, then rename.
/// Prevents readers from seeing a half-written (truncated) file.
fn write_json_atomic(path: &str, data: &str) -> Result<(), String> {
    let tmp = format!("{}.tmp", path);
    fs::write(&tmp, data).map_err(|e| format!("write tmp: {}", e))?;
    fs::rename(&tmp, path).map_err(|e| format!("rename: {}", e))?;
    Ok(())
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
    let p = format!("{}/episodes.json", dir);
    let content = match fs::read_to_string(&p) {
        Ok(s) => s,
        Err(_) => return Ok(vec![]),
    };
    let all_entries: Vec<EpisodicEntry> = match serde_json::from_str(&content) {
        Ok(arr) => arr,
        Err(_) => return Ok(vec![]),
    };
    let count_usize = count as usize;
    let start = all_entries.len().saturating_sub(count_usize);
    Ok(all_entries[start..].to_vec())
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
    let base = format!("{}/.timps/memory", home_dir());
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
    Ok(rank_semantic(entries, &query, limit as usize))
}

/// Pure scoring used by `search_memory` (split out for testability).
fn rank_semantic(entries: Vec<SemanticEntry>, query: &str, limit: usize) -> Vec<SemanticEntry> {
    if query.trim().is_empty() {
        return entries.into_iter().take(limit).collect();
    }

    let words: Vec<String> = query
        .to_lowercase()
        .split_whitespace()
        .map(|w| w.to_string())
        .collect();

    // Short words (≤2 chars like "go", "ai", "db") are legitimate search
    // tokens. Only drop them when the query ALSO has longer words, so a query
    // composed entirely of short words still matches instead of producing an
    // empty word list that silently scores every entry 0.0.
    let words: Vec<String> = if words.iter().any(|w| w.len() > 2) {
        words.into_iter().filter(|w| w.len() > 2).collect()
    } else {
        words
    };

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
    scored.into_iter().take(limit).map(|(_, e)| e).collect()
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
    let _guard = SEMANTIC_LOCK.lock().map_err(|e| e.to_string())?;
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
    write_json_atomic(&p, &s)
}

/// Delete a semantic memory entry by key
#[tauri::command]
pub fn delete_memory(project_path: String, key: String) -> Result<usize, String> {
    let _guard = SEMANTIC_LOCK.lock().map_err(|e| e.to_string())?;
    let dir = memory_dir(&project_path);
    let p = format!("{}/semantic.json", dir);
    let mut entries: Vec<SemanticEntry> = match fs::read_to_string(&p) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => return Ok(0),
    };
    let before = entries.len();
    entries.retain(|e| e.id != key);
    let s = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    write_json_atomic(&p, &s)?;
    Ok(before - entries.len())
}

/// Rough token estimate: 1 token ≈ 4 chars for English text
fn rough_tokens(s: &str) -> usize {
    (s.len() + 3) / 4
}

/// Score a memory entry by relevance to query keywords, recency, and importance.
/// Formula (from ContextCompressor): relevance × 0.4 + recency × 0.3 + importance × 0.3
fn score_entry(query_words: &[String], e: &serde_json::Value, now_secs: i64) -> Option<(f64, f64)> {
    let content = e["content"].as_str()?;
    let tags = e["tags"].as_array()?;
    let haystack = format!(
        "{} {} {}",
        content.to_lowercase(),
        e["type"].as_str().unwrap_or(""),
        tags.iter().filter_map(|t| t.as_str()).collect::<Vec<&str>>().join(" ").to_lowercase()
    );

    let matched: f64 = query_words.iter().map(|w| if haystack.contains(w.as_str()) { 1.0 } else { 0.0 }).sum();
    if matched == 0.0 { return None; }

    let max_possible = query_words.len() as f64;
    let relevance = if max_possible > 0.0 { matched / max_possible } else { 0.0 };

    let entry_ts = e["timestamp"].as_i64().unwrap_or(0);
    let days_old = (now_secs - entry_ts).max(0) as f64 / 86400.0;
    let recency = 1.0 / (1.0 + days_old * 0.05).max(0.1).min(1.0);

    let importance = e["score"].as_f64().unwrap_or(0.5);
    let combined = relevance * 0.4 + recency * 0.3 + importance * 0.3;

    Some((combined, relevance))
}

// ── Provider routing (M84) ─────────────────────────────────────────────────

#[derive(Debug, Clone, Copy)]
struct ProviderDef {
    name: &'static str,
    label: &'static str,
    kind: &'static str, // "ollama" | "openai" | "anthropic"
    default_model: &'static str,
    base_url: &'static str,
    requires_key: bool,
}

/// The providers the desktop app actually routes chat traffic to.
/// OpenAI-compatible providers share the /chat/completions protocol;
/// Anthropic uses its native Messages API; Ollama uses /api/chat.
const PROVIDERS: &[ProviderDef] = &[
    ProviderDef { name: "ollama", label: "Ollama", kind: "ollama", default_model: "qwen2.5-coder:7b", base_url: "http://localhost:11434", requires_key: false },
    ProviderDef { name: "openai", label: "OpenAI", kind: "openai", default_model: "gpt-4o", base_url: "https://api.openai.com/v1", requires_key: true },
    ProviderDef { name: "anthropic", label: "Anthropic", kind: "anthropic", default_model: "claude-sonnet-4-5", base_url: "https://api.anthropic.com", requires_key: true },
    ProviderDef { name: "xai", label: "xAI (Grok)", kind: "openai", default_model: "grok-2", base_url: "https://api.x.ai/v1", requires_key: true },
    ProviderDef { name: "deepseek", label: "DeepSeek", kind: "openai", default_model: "deepseek-chat", base_url: "https://api.deepseek.com/v1", requires_key: true },
    ProviderDef { name: "mistral", label: "Mistral", kind: "openai", default_model: "mistral-large-latest", base_url: "https://api.mistral.ai/v1", requires_key: true },
    ProviderDef { name: "openrouter", label: "OpenRouter", kind: "openai", default_model: "openrouter/auto", base_url: "https://openrouter.ai/api/v1", requires_key: true },
    ProviderDef { name: "groq", label: "Groq", kind: "openai", default_model: "llama-3.3-70b-versatile", base_url: "https://api.groq.com/openai/v1", requires_key: true },
    ProviderDef { name: "together", label: "Together AI", kind: "openai", default_model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", base_url: "https://api.together.xyz/v1", requires_key: true },
    ProviderDef { name: "fireworks", label: "Fireworks AI", kind: "openai", default_model: "accounts/fireworks/models/llama-v3p3-70b-instruct", base_url: "https://api.fireworks.ai/inference/v1", requires_key: true },
    ProviderDef { name: "perplexity", label: "Perplexity", kind: "openai", default_model: "sonar", base_url: "https://api.perplexity.ai", requires_key: true },
    ProviderDef { name: "lmstudio", label: "LM Studio", kind: "openai", default_model: "local-model", base_url: "http://localhost:1234/v1", requires_key: false },
    ProviderDef { name: "jan", label: "Jan", kind: "openai", default_model: "local-model", base_url: "http://localhost:1337/v1", requires_key: false },
    ProviderDef { name: "vllm", label: "vLLM", kind: "openai", default_model: "local-model", base_url: "http://localhost:8000/v1", requires_key: false },
];

/// Persisted provider settings (~/.timps/desktop.json). Survives restarts.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DesktopConfig {
    #[serde(default)]
    provider: String,
    #[serde(default)]
    model: String,
    #[serde(default, rename = "baseUrl")]
    base_url: String,
    #[serde(default, rename = "apiKey")]
    api_key: String,
}

fn desktop_config_path() -> String {
    format!("{}/.timps/desktop.json", home_dir())
}

fn load_desktop_config() -> DesktopConfig {
    let path = desktop_config_path();
    match std::fs::read_to_string(&path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => DesktopConfig::default(),
    }
}

fn save_desktop_config(cfg: &DesktopConfig) -> Result<(), String> {
    let path = desktop_config_path();
    let dir = Path::new(&path).parent().unwrap_or(Path::new("/"));
    std::fs::create_dir_all(dir).map_err(|e| format!("Cannot create {}: {}", dir.display(), e))?;
    let s = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    let tmp = format!("{path}.tmp");
    std::fs::write(&tmp, &s).map_err(|e| format!("Cannot write {}: {}", tmp, e))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("Cannot save config: {}", e))?;
    Ok(())
}

fn resolve_config_model(cfg: &DesktopConfig, def: &ProviderDef) -> String {
    if !cfg.model.trim().is_empty() {
        cfg.model.trim().to_string()
    } else {
        def.default_model.to_string()
    }
}

fn emit_chat_done(app: &tauri::AppHandle, text: &str, input_tokens: u32, output_tokens: u32) {
    use tauri::Emitter;
    let _ = app.emit("chat:done", serde_json::json!({
        "text": text,
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
    }));
}

async fn chat_ollama(
    app: &tauri::AppHandle,
    cfg: &DesktopConfig,
    def: &ProviderDef,
    messages: &[serde_json::Value],
    override_model: Option<&str>,
) -> Result<(), String> {
    let ollama_url = std::env::var("OLLAMA_URL")
        .unwrap_or_else(|_| def.base_url.to_string());
    let model = override_model
        .filter(|m| !m.trim().is_empty())
        .map(|m| m.trim().to_string())
        .unwrap_or_else(|| resolve_config_model(cfg, def));

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false,
        "options": { "num_ctx": 32768 }
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/chat", ollama_url))
        .json(&body)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                format!("Ollama request timed out after 60s at {ollama_url}")
            } else {
                format!("Cannot reach Ollama at {ollama_url}. Is it running? (ollama serve)")
            }
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama {status}: {text}"));
    }

    let j: serde_json::Value = resp.json().await.map_err(|e| format!("Failed to parse Ollama response: {e}"))?;
    let text = j["message"]["content"].as_str().unwrap_or("").to_string();
    let input_tokens = j["prompt_eval_count"].as_u64().unwrap_or(0) as u32;
    let output_tokens = j["eval_count"].as_u64().unwrap_or(0) as u32;
    emit_chat_done(app, &text, input_tokens, output_tokens);
    Ok(())
}

async fn chat_openai_compatible(
    app: &tauri::AppHandle,
    cfg: &DesktopConfig,
    def: &ProviderDef,
    messages: &[serde_json::Value],
) -> Result<(), String> {
    if def.requires_key && cfg.api_key.trim().is_empty() {
        return Err(format!("No API key set for {}. Add one in Settings.", def.label));
    }
    let base = if !cfg.base_url.trim().is_empty() {
        cfg.base_url.trim().to_string()
    } else {
        def.base_url.to_string()
    };
    let model = resolve_config_model(cfg, def);

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false,
    });

    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", cfg.api_key.trim()))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                format!("{} request timed out after 60s at {url}", def.label)
            } else {
                format!("Cannot reach {} at {url}", def.label)
            }
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("{} {status}: {text}", def.label));
    }

    let j: serde_json::Value = resp.json().await.map_err(|e| format!("Failed to parse {} response: {e}", def.label))?;
    let text = j["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string();
    let input_tokens = j["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;
    let output_tokens = j["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32;
    emit_chat_done(app, &text, input_tokens, output_tokens);
    Ok(())
}

async fn chat_anthropic(
    app: &tauri::AppHandle,
    cfg: &DesktopConfig,
    def: &ProviderDef,
    messages: &[serde_json::Value],
) -> Result<(), String> {
    if def.requires_key && cfg.api_key.trim().is_empty() {
        return Err(format!("No API key set for {}. Add one in Settings.", def.label));
    }
    let base = if !cfg.base_url.trim().is_empty() {
        cfg.base_url.trim().to_string()
    } else {
        def.base_url.to_string()
    };
    let model = resolve_config_model(cfg, def);

    let mut system = String::new();
    let api_messages: Vec<serde_json::Value> = messages
        .iter()
        .filter_map(|m| {
            let role = m["role"].as_str().unwrap_or("user");
            let content = m["content"].as_str().unwrap_or("");
            if role == "system" {
                if !system.is_empty() {
                    system.push_str("\n\n");
                }
                system.push_str(content);
                None
            } else {
                Some(serde_json::json!({ "role": role, "content": content }))
            }
        })
        .collect();

    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": 2048,
        "messages": api_messages,
    });
    if !system.is_empty() {
        body["system"] = serde_json::Value::String(system);
    }

    let client = reqwest::Client::new();
    let url = format!("{}/v1/messages", base.trim_end_matches('/'));
    let resp = client
        .post(&url)
        .header("x-api-key", cfg.api_key.trim())
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                format!("{} request timed out after 60s at {url}", def.label)
            } else {
                format!("Cannot reach {} at {url}", def.label)
            }
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("{} {status}: {text}", def.label));
    }

    let j: serde_json::Value = resp.json().await.map_err(|e| format!("Failed to parse {} response: {e}", def.label))?;
    let text = j["content"][0]["text"].as_str().unwrap_or("").to_string();
    let input_tokens = j["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
    let output_tokens = j["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32;
    emit_chat_done(app, &text, input_tokens, output_tokens);
    Ok(())
}

/// Chat directly with the configured LLM provider (Ollama, OpenAI-compatible,
/// or Anthropic). No proxy server needed. Non-streaming.
#[tauri::command]
pub async fn chat(
    app: tauri::AppHandle,
    prompt: String,
    model: Option<String>,
    project_path: Option<String>,
) -> Result<(), String> {
    use tauri::Emitter;

    let mut messages: Vec<serde_json::Value> = Vec::new();
    let token_budget: usize = 2000;

    if let Some(pp) = &project_path {
        if !pp.is_empty() {
            let mem_dir = memory_dir(pp);
            let now_secs = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;

            let query_words: Vec<String> = prompt
                .to_lowercase()
                .split_whitespace()
                .filter(|w| w.len() > 2)
                .map(|w| w.to_string())
                .collect();

            // ── 1. Score semantic facts ──
            let sem_path = format!("{}/semantic.json", mem_dir);
            let mut all_scored: Vec<(f64, f64, String, &str)> = Vec::new(); // (combined, relevance, content, layer)

            if let Ok(s) = std::fs::read_to_string(&sem_path) {
                if let Ok(entries) = serde_json::from_str::<Vec<serde_json::Value>>(&s) {
                    for e in &entries {
                        if let Some((combined, relevance)) = score_entry(&query_words, e, now_secs) {
                            if let Some(content) = e["content"].as_str() {
                                let tags: String = e["tags"].as_array()
                                    .map(|a| a.iter().filter_map(|t| t.as_str()).collect::<Vec<&str>>().join(", "))
                                    .unwrap_or_default();
                                let formatted = format!("- {} [tags: {}]", content, tags);
                                all_scored.push((combined, relevance, formatted, "semantic"));
                            }
                        }
                    }
                }
            }

            // ── 2. Score recent episodes ──
            let ep_path = format!("{}/episodes.jsonl", mem_dir);
            if let Ok(file) = std::fs::File::open(&ep_path) {
                let episodes: Vec<serde_json::Value> = BufReader::new(file)
                    .lines()
                    .filter_map(|l| l.ok())
                    .filter(|l| !l.trim().is_empty())
                    .filter_map(|l| serde_json::from_str(&l).ok())
                    .collect();

                let window = episodes.len().min(20);
                for e in episodes.iter().rev().take(window) {
                    if let Some(summary) = e["summary"].as_str() {
                        let ep_content = format!("[Episode] {} — outcome: {}", summary, e["outcome"].as_str().unwrap_or("unknown"));
                        let ep_json = serde_json::json!({
                            "content": ep_content,
                            "tags": e["tags"].as_array().cloned().unwrap_or_default(),
                            "score": 0.5,
                            "timestamp": e["timestamp"].as_i64().unwrap_or(0),
                            "type": "episode"
                        });
                        if let Some((combined, _)) = score_entry(&query_words, &ep_json, now_secs) {
                            all_scored.push((combined, 0.0, ep_content, "episodic"));
                        }
                    }
                }
            }

            // ── 3. Sort by combined score ──
            all_scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

            // ── 4. Pack within token budget (ContextCompressor style) ──
            if !all_scored.is_empty() {
                let mut ctx_parts: Vec<&str> = Vec::new();
                let mut used_tokens = 0usize;
                let header = "Relevant memory:\n";
                used_tokens += rough_tokens(header);

                for (_, _, ref content, _) in &all_scored {
                    let line_tokens = rough_tokens(content);
                    if used_tokens + line_tokens + 1 > token_budget {
                        break;
                    }
                    ctx_parts.push(content.as_str());
                    used_tokens += line_tokens + 1;
                }

                let facts_str = ctx_parts.join("\n");
                let context = format!(
                    "You have a persistent memory. Here are the relevant facts about the user and the project:\n{}\n\nUse these facts when answering. If the user asks something you don't know, say so.\n[memory tokens: ~{}/{}]",
                    facts_str, used_tokens, token_budget
                );
                messages.push(serde_json::json!({"role": "system", "content": context}));
            }
        }
    }

    messages.push(serde_json::json!({"role": "user", "content": prompt}));

    // ── Route to the persisted provider ──
    let cfg = load_desktop_config();
    let provider_name = if cfg.provider.is_empty() { "ollama" } else { cfg.provider.as_str() };
    let def = match PROVIDERS.iter().find(|p| p.name == provider_name) {
        Some(d) => d,
        None => {
            let msg = format!("Unsupported provider: {provider_name}");
            let _ = app.emit("chat:error", serde_json::json!({ "message": msg }));
            return Err(msg);
        }
    };

    let result = match def.kind {
        "ollama" => chat_ollama(&app, &cfg, def, &messages, model.as_deref()).await,
        "openai" => chat_openai_compatible(&app, &cfg, def, &messages).await,
        "anthropic" => chat_anthropic(&app, &cfg, def, &messages).await,
        other => Err(format!("Provider '{}' kind '{}' is not supported", def.name, other)),
    };

    if let Err(msg) = &result {
        // A failure here previously left the frontend chat promise pending
        // forever (spinner never clears). Surface a clear error instead.
        let _ = app.emit("chat:error", serde_json::json!({ "message": msg }));
    }
    result
}

/// List models available in Ollama
#[tauri::command]
pub async fn list_ollama_models() -> Result<Vec<String>, String> {
    let ollama_url = std::env::var("OLLAMA_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/api/tags", ollama_url))
        .timeout(std::time::Duration::from_secs(10))
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
    let cfg = load_desktop_config();
    if cfg.provider.is_empty() { "ollama".to_string() } else { cfg.provider }
}

/// Set the LLM provider (persisted to ~/.timps/desktop.json)
#[tauri::command]
pub fn set_provider(provider: String) -> Result<(), String> {
    if !PROVIDERS.iter().any(|p| p.name == provider) {
        return Err(format!("Unknown provider: {provider}"));
    }
    let mut cfg = load_desktop_config();
    cfg.provider = provider.clone();
    if cfg.model.is_empty() {
        cfg.model = PROVIDERS
            .iter()
            .find(|p| p.name == provider)
            .map(|p| p.default_model)
            .unwrap_or("")
            .to_string();
    }
    save_desktop_config(&cfg)
}

/// Get the full provider config (provider, model, baseUrl, apiKey)
#[tauri::command]
pub fn get_provider_config() -> serde_json::Value {
    let cfg = load_desktop_config();
    serde_json::json!({
        "provider": if cfg.provider.is_empty() { "ollama" } else { &cfg.provider },
        "model": cfg.model,
        "baseUrl": cfg.base_url,
        "apiKey": cfg.api_key,
    })
}

/// Persist the full provider config to ~/.timps/desktop.json
#[tauri::command]
pub fn set_provider_config(
    provider: String,
    model: String,
    base_url: String,
    api_key: String,
) -> Result<(), String> {
    if !PROVIDERS.iter().any(|p| p.name == provider) {
        return Err(format!("Unknown provider: {provider}"));
    }
    save_desktop_config(&DesktopConfig {
        provider,
        model,
        base_url,
        api_key,
    })
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

    let _guard = SEMANTIC_LOCK.lock().map_err(|e| e.to_string())?;
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
        // Safe char-boundary slice: find the last char boundary ≤ 8 bytes
        {
            let limit = lc_new.char_indices()
                .take_while(|(i, _)| *i < 8)
                .last()
                .map(|(i, c)| i + c.len_utf8())
                .unwrap_or(0);
            lc_new[..limit].replace(' ', "_")
        }
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
    write_json_atomic(&p, &s)?;
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

    // Lock only the critical section: re-read + merge + write
    {
        let _guard = SEMANTIC_LOCK.lock().map_err(|e| e.to_string())?;
        // Re-read under lock in case another thread wrote since our earlier read
        sem_entries = match fs::read_to_string(&sem_path) {
            Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
            Err(_) => vec![],
        };

        for fact in &new_facts {
            if existing_synthesized.contains(fact) {
                continue;
            }
            if fact.trim().len() < 15 {
                continue;
            }
            // Deduplicate against current entries under lock
            if sem_entries.iter().any(|e| e.content == *fact) {
                continue;
            }
            let id = format!("synth_{}_{}", now_ts, added);
            sem_entries.push(SemanticEntry {
                id,
                timestamp: now_ts,
                kind: "pattern".to_string(),
                content: fact.clone(),
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
            write_json_atomic(&sem_path, &s)?;
        }
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
    format!("{}/.timps/lens", home_dir())
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
    let home = home_dir();
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

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(id: &str, content: &str, tags: &[&str]) -> SemanticEntry {
        SemanticEntry {
            id: id.to_string(),
            timestamp: 0,
            kind: "fact".to_string(),
            content: content.to_string(),
            tags: tags.iter().map(|s| s.to_string()).collect(),
            score: None,
        }
    }

    fn ids(results: &[SemanticEntry]) -> Vec<&str> {
        results.iter().map(|e| e.id.as_str()).collect()
    }

    #[test]
    fn short_word_query_matches_entries() {
        // M82: 'go' used to be filtered out → zero results.
        let entries = vec![
            entry("1", "Set up Go module for the project", &["golang"]),
            entry("2", "Rust backend service", &["rust"]),
        ];
        let results = rank_semantic(entries, "go", 10);
        assert_eq!(ids(&results), vec!["1"]);
    }

    #[test]
    fn all_short_words_query_matches() {
        // M82: 'ai db' (both ≤2 chars) previously produced an empty word list.
        let entries = vec![
            entry("1", "AI assistant for the db layer", &[]),
            entry("2", "frontend components", &["react"]),
        ];
        let results = rank_semantic(entries, "ai db", 10);
        assert_eq!(ids(&results), vec!["1"]);
    }

    #[test]
    fn short_word_does_not_match_everything() {
        // 'go' must not be treated as matching unrelated entries.
        let entries = vec![
            entry("1", "Rust backend service", &["rust"]),
            entry("2", "Deploy to a Go service", &[]),
        ];
        let results = rank_semantic(entries, "go", 10);
        assert_eq!(ids(&results), vec!["2"]);
    }

    #[test]
    fn mixed_query_still_filters_short_noise_words() {
        // Long words present → short noise words are dropped (prior behavior).
        let entries = vec![
            entry("1", "Postgres database tuning", &["db"]),
            entry("2", "api design for dashboard", &["ui"]),
        ];
        let results = rank_semantic(entries, "db postgres", 10);
        assert_eq!(ids(&results), vec!["1"]);
    }

    #[test]
    fn empty_query_returns_first_n_entries() {
        let entries = vec![
            entry("1", "first", &[]),
            entry("2", "second", &[]),
            entry("3", "third", &[]),
        ];
        let results = rank_semantic(entries, "   ", 2);
        assert_eq!(ids(&results), vec!["1", "2"]);
    }

    #[test]
    fn no_match_returns_empty() {
        let entries = vec![entry("1", "cooking recipes", &["kitchen"])];
        let results = rank_semantic(entries, "kubernetes", 10);
        assert!(results.is_empty());
    }

    #[test]
    fn limit_is_respected() {
        let entries = vec![
            entry("1", "alpha beta", &[]),
            entry("2", "beta gamma", &[]),
            entry("3", "beta delta", &[]),
        ];
        let results = rank_semantic(entries, "beta", 2);
        assert_eq!(results.len(), 2);
    }

    // ── M84: provider routing registry ───────────────────────────────────

    #[test]
    fn provider_registry_has_only_supported_kinds() {
        for p in PROVIDERS {
            assert!(
                p.kind == "ollama" || p.kind == "openai" || p.kind == "anthropic",
                "{} has unsupported kind {}",
                p.name,
                p.kind
            );
            assert!(!p.default_model.is_empty(), "{} has no default model", p.name);
            assert!(!p.base_url.is_empty(), "{} has no base URL", p.name);
        }
    }

    #[test]
    fn provider_registry_includes_ollama() {
        assert!(PROVIDERS.iter().any(|p| p.name == "ollama"));
    }

    #[test]
    fn provider_registry_no_duplicate_names() {
        let mut names: Vec<&str> = PROVIDERS.iter().map(|p| p.name).collect();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), PROVIDERS.len());
    }

    #[test]
    fn provider_registry_local_providers_do_not_require_key() {
        for name in ["ollama", "lmstudio", "jan", "vllm"] {
            let def = PROVIDERS.iter().find(|p| p.name == name).unwrap();
            assert!(!def.requires_key, "{} should not require an API key", name);
        }
    }

    #[test]
    fn unknown_provider_is_rejected() {
        let result = set_provider("not-a-provider".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn config_round_trips_through_desktop_json() {
        // Isolate from the real ~/.timps config via a temp HOME.
        let temp = std::env::temp_dir().join(format!("timps-cfg-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&temp);
        std::env::set_var("HOME", &temp);

        set_provider("openai".to_string()).expect("set_provider should persist");
        assert_eq!(get_provider(), "openai");

        let value = get_provider_config();
        assert_eq!(value["provider"], "openai");
        assert_eq!(value["model"], "gpt-4o", "default model should fill empty config model");
        assert_eq!(value["baseUrl"], "");
        assert_eq!(value["apiKey"], "");

        set_provider_config(
            "anthropic".to_string(),
            "claude-sonnet-4-5".to_string(),
            "https://api.anthropic.com".to_string(),
            "sk-test".to_string(),
        )
        .expect("set_provider_config should persist");
        let value = get_provider_config();
        assert_eq!(value["provider"], "anthropic");
        assert_eq!(value["apiKey"], "sk-test");
        assert_eq!(get_provider(), "anthropic");

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn resolve_config_model_prefers_configured_model() {
        let cfg = DesktopConfig {
            provider: "openai".to_string(),
            model: "gpt-4o-mini".to_string(),
            ..Default::default()
        };
        let def = PROVIDERS.iter().find(|p| p.name == "openai").unwrap();
        assert_eq!(resolve_config_model(&cfg, def), "gpt-4o-mini");

        let empty = DesktopConfig::default();
        assert_eq!(resolve_config_model(&empty, def), "gpt-4o");
    }
}
