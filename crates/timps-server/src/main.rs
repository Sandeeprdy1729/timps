//! timps-server — Axum REST API server (replaces sandeep-ai/api/server.ts).
//! Routes:
//!   POST /chat            — run agent turn
//!   GET  /memory          — list semantic memories
//!   POST /memory          — store semantic memory
//!   DELETE /memory/:key   — delete a memory
//!   GET  /memory/episodes — recent episodes
//!   GET  /tools           — list available tools
//!   GET  /health          — health check

use anyhow::Result;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::mpsc;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::EnvFilter;
use timps_agent::{Agent, AgentBuilder, AgentOptions, AgentEvent};
use timps_memory::{MemoryStore, SemanticEntry};
use timps_providers::ProviderRegistry;
use timps_tools::ToolRegistry;

// ── App state ───────────────────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    memory: Arc<MemoryStore>,
    tools: Arc<ToolRegistry>,
    providers: Arc<ProviderRegistry>,
    cwd: String,
}

// ── Request / Response types ────────────────────────────────────────────────

#[derive(Deserialize)]
struct ChatRequest {
    prompt: String,
    provider: Option<String>,
    model: Option<String>,
    /// Absolute path to the project whose memory should be used.
    /// Falls back to the server's cwd when absent.
    project_path: Option<String>,
}

#[derive(Serialize)]
struct ChatResponse {
    output: String,
    tool_calls_made: usize,
    memories_injected: usize,
}

#[derive(Deserialize)]
struct StoreMemoryRequest {
    key: String,
    value: String,
    importance: Option<f32>,
    tags: Option<Vec<String>>,
}

// ── Route handlers ───────────────────────────────────────────────────────────

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "service": "timps-server" }))
}

async fn chat(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, (StatusCode, String)> {
    let provider_name = req.provider.as_deref().unwrap_or("ollama");
    let provider = state.providers.get(provider_name)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, format!("Unknown provider: {provider_name}")))?;

    // Use project-specific memory when project_path is provided
    let memory: Arc<MemoryStore> = match &req.project_path {
        Some(path) => Arc::new(
            MemoryStore::open(path)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        ),
        None => state.memory.clone(),
    };

    let agent = AgentBuilder::new()
        .provider(provider)
        .memory(memory)
        .opts(AgentOptions::default())
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (tx, mut rx) = mpsc::channel(64);
    let handle = tokio::spawn(async move {
        agent.run(&req.prompt, vec![], tx).await
    });

    // Drain events
    while rx.recv().await.is_some() {}

    let result = handle.await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ChatResponse {
        output: result.output,
        tool_calls_made: result.tool_calls_made,
        memories_injected: result.memories_injected,
    }))
}

async fn get_memories(State(state): State<AppState>) -> Result<Json<Value>, (StatusCode, String)> {
    state.memory.load_semantic().await
        .map(|e| Json(json!(e)))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn store_memory(
    State(state): State<AppState>,
    Json(req): Json<StoreMemoryRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    state.memory.store_semantic(SemanticEntry {
        key: req.key.clone(),
        value: req.value,
        importance: req.importance.unwrap_or(0.5),
        tags: req.tags.unwrap_or_default(),
    }).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(json!({ "stored": req.key })))
}

async fn delete_memory(
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut entries = state.memory.load_semantic().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let before = entries.len();
    entries.retain(|e| e.key != key);
    state.memory.save_semantic(&entries).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(json!({ "deleted": before - entries.len() })))
}

async fn get_episodes(State(state): State<AppState>) -> Result<Json<Value>, (StatusCode, String)> {
    state.memory.load_episodes(50).await
        .map(|e| Json(json!(e)))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn list_tools(State(state): State<AppState>) -> Json<Value> {
    let tools: Vec<Value> = state.tools.all().iter()
        .map(|t| json!({ "name": t.name(), "description": t.description() }))
        .collect();
    Json(json!({ "tools": tools }))
}

// ── Main ─────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("timps=info".parse()?))
        .init();

    let cwd = std::env::current_dir()?.to_string_lossy().to_string();
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());

    let memory = Arc::new(MemoryStore::open(&cwd)?);
    let tools = Arc::new(ToolRegistry::with_builtins());
    let providers = Arc::new(ProviderRegistry::from_env());

    let state = AppState { memory, tools, providers, cwd };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/chat", post(chat))
        .route("/memory", get(get_memories))
        .route("/memory", post(store_memory))
        .route("/memory/:key", delete(delete_memory))
        .route("/memory/episodes", get(get_episodes))
        .route("/tools", get(list_tools))
        .layer(cors)
        .with_state(state);

    let addr = format!("0.0.0.0:{port}");
    tracing::info!("TIMPS server listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
