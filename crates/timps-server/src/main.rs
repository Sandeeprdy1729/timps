//! timps-server — Axum REST API server (replaces packages/server/api/server.ts).
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
    extract::{Path, Request, State},
    http::StatusCode,
    middleware::{self, Next},
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
    api_key: Option<String>,
}

// ── Auth middleware ─────────────────────────────────────────────────────────

async fn auth_middleware(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<impl axum::response::IntoResponse, StatusCode> {
    // Skip auth if no API key configured
    let Some(expected_key) = &state.api_key else {
        return Ok(next.run(request).await);
    };

    // Check Authorization header: "Bearer <api_key>"
    let auth_header = request
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok());

    match auth_header {
        Some(header) if header.starts_with("Bearer ") => {
            let provided = &header[7..];
            if provided == expected_key {
                Ok(next.run(request).await)
            } else {
                Err(StatusCode::UNAUTHORIZED)
            }
        }
        _ => Err(StatusCode::UNAUTHORIZED),
    }
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
    let api_key = std::env::var("TIMPS_API_KEY").ok().filter(|k| !k.is_empty());
    // Bind to 0.0.0.0 only when TIMPS_LISTEN_ALL=1; default to 127.0.0.1
    let bind_all = std::env::var("TIMPS_LISTEN_ALL").map_or(false, |v| v == "1" || v == "true");

    if api_key.is_none() {
        tracing::warn!("No TIMPS_API_KEY set — server is running WITHOUT authentication. Set TIMPS_API_KEY to require Bearer tokens.");
    }

    let memory = Arc::new(MemoryStore::open(&cwd)?);
    let tools = Arc::new(ToolRegistry::with_builtins());
    let providers = Arc::new(ProviderRegistry::from_env());

    let state = AppState { memory, tools, providers, cwd, api_key };

    let cors = if bind_all {
        // When exposed to the network, restrict to localhost origins
        CorsLayer::new()
            .allow_origin([
                "http://localhost".parse().unwrap(),
                "http://localhost:3000".parse().unwrap(),
                "http://127.0.0.1".parse().unwrap(),
                "http://127.0.0.1:3000".parse().unwrap(),
            ])
            .allow_methods([
                "GET".parse().unwrap(),
                "POST".parse().unwrap(),
                "DELETE".parse().unwrap(),
                "OPTIONS".parse().unwrap(),
            ])
            .allow_headers([
                "authorization".parse().unwrap(),
                "content-type".parse().unwrap(),
            ])
    } else {
        // Localhost-only binding: allow any origin since it's loopback
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
    };

    let protected_routes = Router::new()
        .route("/chat", post(chat))
        .route("/memory", get(get_memories))
        .route("/memory", post(store_memory))
        .route("/memory/:key", delete(delete_memory))
        .route("/memory/episodes", get(get_episodes))
        .route("/tools", get(list_tools))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    let app = Router::new()
        .route("/health", get(health))
        .merge(protected_routes)
        .layer(cors)
        .with_state(state);

    let host = if bind_all { "0.0.0.0" } else { "127.0.0.1" };
    let addr = format!("{host}:{port}");
    tracing::info!("TIMPS server listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
