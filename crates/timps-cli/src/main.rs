//! timps-cli — Native CLI binary (replaces timps-code Node.js CLI).
//! Build: cargo build --release -p timps-cli
//! Install: cargo install --path crates/timps-cli

use anyhow::Result;
use clap::{Parser, Subcommand};
use std::sync::Arc;
use tokio::sync::mpsc;
use timps_agent::{Agent, AgentBuilder, AgentOptions, AgentEvent, recipes::RecipeRunner};
use timps_memory::MemoryStore;
use timps_providers::{ProviderConfig, ProviderRegistry};
use timps_tools::ToolRegistry;

// ── CLI definition ──────────────────────────────────────────────────────────

#[derive(Parser)]
#[command(
    name = "timps",
    version = env!("CARGO_PKG_VERSION"),
    about = "TIMPS — The AI Coding Agent That Remembers",
    long_about = "Run TIMPS with a prompt or interactively. Uses Ollama by default (free, local)."
)]
struct Cli {
    /// Task to perform (omit for interactive REPL)
    prompt: Option<String>,

    #[command(subcommand)]
    command: Option<Commands>,

    /// Provider: ollama, claude, openai, gemini, groq, mistral, etc.
    #[arg(short, long)]
    provider: Option<String>,

    /// Model override (e.g. gpt-4o, claude-sonnet-4-5)
    #[arg(short, long)]
    model: Option<String>,

    /// Working directory
    #[arg(short, long)]
    cwd: Option<String>,
}

#[derive(Subcommand)]
enum Commands {
    /// Configure provider, model, and API keys
    Config,

    /// List available providers (shows ✓ if API key is set)
    Providers,

    /// Show memory stored for this project
    Memory {
        /// Search query
        query: Option<String>,
    },

    /// Run a recipe file
    Run {
        /// Path to recipe YAML file
        recipe: String,
    },

    /// Install, list, or remove plugins
    Plugin {
        #[command(subcommand)]
        action: PluginAction,
    },

    /// Run diagnostics
    Doctor,
}

#[derive(Subcommand)]
enum PluginAction {
    /// Install a plugin from npm
    Install { package: String },
    /// List installed plugins
    List,
    /// Remove a plugin
    Remove { name: String },
}

// ── Main ─────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    let cwd = cli.cwd
        .clone()
        .unwrap_or_else(|| std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string()));

    let memory = Arc::new(MemoryStore::open(&cwd)?);
    let tools = Arc::new(ToolRegistry::with_builtins());
    let providers = ProviderRegistry::from_env();

    match cli.command {
        Some(Commands::Config) => run_config().await?,
        Some(Commands::Providers) => run_providers(&providers),
        Some(Commands::Memory { query }) => run_memory(&memory, query).await?,
        Some(Commands::Run { recipe }) => run_recipe(&recipe, memory, tools, providers).await?,
        Some(Commands::Plugin { action }) => run_plugin(action)?,
        Some(Commands::Doctor) => run_doctor(&cwd, &providers),
        None => {
            let provider_name = cli.provider
                .or_else(|| std::env::var("TIMPS_PROVIDER").ok())
                .unwrap_or_else(|| "ollama".to_string());

            let provider = providers.get(&provider_name)
                .ok_or_else(|| anyhow::anyhow!("Unknown provider: {provider_name}. Run `timps providers` to see options."))?;

            match cli.prompt {
                Some(prompt) => run_one_shot(&prompt, provider, memory, tools).await?,
                None => run_interactive(provider, memory, tools).await?,
            }
        }
    }
    Ok(())
}

// ── Subcommand implementations ───────────────────────────────────────────────

async fn run_config() -> Result<()> {
    let mut cfg = ProviderConfig::load();
    println!("TIMPS Configuration");
    println!("───────────────────");
    println!("Config file: ~/.timps/config.toml");
    println!();
    println!("Current settings:");
    println!("  provider: {}", cfg.provider);
    if let Some(model) = &cfg.model {
        println!("  model:    {model}");
    }
    if let Some(url) = &cfg.base_url {
        println!("  base_url: {url}");
    }
    if cfg.api_key.is_some() {
        println!("  api_key:  ****(set)");
    }
    println!();
    println!("Environment variables (override config.toml):");
    println!("  TIMPS_PROVIDER=ollama|claude|openai|gemini|groq|...");
    println!("  TIMPS_MODEL=...");
    println!("  ANTHROPIC_API_KEY=...");
    println!("  OPENAI_API_KEY=...");
    println!("  GEMINI_API_KEY=...");
    println!("  GROQ_API_KEY=...");
    println!("  OPENROUTER_API_KEY=...");

    // If provider env is set, sync it to config
    if let Ok(provider) = std::env::var("TIMPS_PROVIDER") {
        cfg.provider = provider;
    }
    if let Ok(model) = std::env::var("TIMPS_MODEL") {
        cfg.model = Some(model);
    }
    cfg.save()?;
    println!("\nConfig saved to ~/.timps/config.toml");
    Ok(())
}

fn run_providers(registry: &ProviderRegistry) {
    println!("Available providers:");
    println!("────────────────────");
    let configured = [
        ("ollama", true),  // always available (local)
        ("openai", std::env::var("OPENAI_API_KEY").is_ok()),
        ("claude", std::env::var("ANTHROPIC_API_KEY").is_ok()),
        ("gemini", std::env::var("GEMINI_API_KEY").is_ok()),
        ("groq", std::env::var("GROQ_API_KEY").is_ok()),
        ("mistral", std::env::var("MISTRAL_API_KEY").is_ok()),
        ("cohere", std::env::var("COHERE_API_KEY").is_ok()),
        ("together", std::env::var("TOGETHER_API_KEY").is_ok()),
        ("deepseek", std::env::var("DEEPSEEK_API_KEY").is_ok()),
        ("perplexity", std::env::var("PERPLEXITY_API_KEY").is_ok()),
        ("openrouter", std::env::var("OPENROUTER_API_KEY").is_ok()),
        ("azure", std::env::var("AZURE_OPENAI_API_KEY").is_ok()),
    ];
    for (name, ready) in &configured {
        let icon = if *ready { "✓" } else { "○" };
        println!("  {icon} {name}");
    }
    println!();
    println!("✓ = configured  ○ = API key not set");
}

async fn run_memory(memory: &Arc<MemoryStore>, query: Option<String>) -> Result<()> {
    let entries = if let Some(q) = query {
        memory.search_relevant(&q, 20).await?
    } else {
        memory.load_semantic().await?
    };

    if entries.is_empty() {
        println!("No memories stored for this project.");
        return Ok(());
    }

    println!("Stored memories ({}):", entries.len());
    println!("──────────────────────");
    for e in &entries {
        println!("[{}] {}", e.key, e.value);
        if !e.tags.is_empty() {
            println!("    tags: {}", e.tags.join(", "));
        }
    }
    Ok(())
}

async fn run_recipe(
    recipe_path: &str,
    memory: Arc<MemoryStore>,
    tools: Arc<ToolRegistry>,
    providers: ProviderRegistry,
) -> Result<()> {
    let path = std::path::Path::new(recipe_path);
    let recipe = RecipeRunner::load(path)?;
    println!("Running recipe: {}", recipe.name);
    if let Some(desc) = &recipe.description {
        println!("  {desc}");
    }
    println!("  {} step(s)\n", recipe.steps.len());

    let provider_name = std::env::var("TIMPS_PROVIDER").unwrap_or_else(|_| "ollama".to_string());
    let runner = RecipeRunner::new(memory, tools, Arc::new(providers), provider_name);
    let result = runner.run(&recipe, std::collections::HashMap::new(), |event| {
        match event {
            AgentEvent::Token(t) => print!("{t}"),
            AgentEvent::ToolCallStart { name } => eprintln!("\n[tool: {name}]"),
            AgentEvent::TurnComplete(r) => {
                eprintln!("\n  ({}, {} tool calls)", r.output.len(), r.tool_calls_made);
            }
            _ => {}
        }
    }).await?;

    println!("\n──────────────────────");
    println!("Recipe: {} — {} step(s) completed", result.recipe_name, result.steps.len());
    for s in &result.steps {
        let status = if s.skipped { "SKIP" } else { "OK" };
        println!("  [{status}] {}: {} chars", s.name, s.output.len());
    }
    Ok(())
}

fn plugins_path() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".timps").join("plugins.json"))
}

fn load_plugins() -> Vec<String> {
    plugins_path()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|c| serde_json::from_str::<Vec<String>>(&c).ok())
        .unwrap_or_default()
}

fn save_plugins(plugins: &[String]) -> Result<()> {
    let path = plugins_path().ok_or_else(|| anyhow::anyhow!("cannot find home dir"))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, serde_json::to_string_pretty(plugins)?)?;
    Ok(())
}

fn run_plugin(action: PluginAction) -> Result<()> {
    match action {
        PluginAction::Install { package } => {
            println!("Installing plugin: {package}");
            let status = std::process::Command::new("npm")
                .args(["install", "-g", &package])
                .status()?;
            if status.success() {
                let mut plugins = load_plugins();
                if !plugins.contains(&package) {
                    plugins.push(package.clone());
                    save_plugins(&plugins)?;
                }
                println!("Plugin {package} installed.");
            } else {
                anyhow::bail!("npm install failed with status: {status}");
            }
        }
        PluginAction::List => {
            let plugins = load_plugins();
            if plugins.is_empty() {
                println!("No plugins installed.");
            } else {
                println!("Installed plugins ({}):", plugins.len());
                for p in &plugins {
                    println!("  - {p}");
                }
            }
        }
        PluginAction::Remove { name } => {
            let mut plugins = load_plugins();
            let before = plugins.len();
            plugins.retain(|p| p != &name);
            if plugins.len() == before {
                println!("Plugin '{name}' not found.");
            } else {
                save_plugins(&plugins)?;
                println!("Plugin '{name}' removed.");
            }
        }
    }
    Ok(())
}

fn run_doctor(cwd: &str, providers: &ProviderRegistry) {
    println!("TIMPS Doctor");
    println!("────────────");
    let memory_dir = dirs::home_dir()
        .map(|h| h.join(".timps").join("memory"))
        .filter(|p| p.exists());
    println!("{} Memory store: {}", if memory_dir.is_some() { "✓" } else { "○" },
             memory_dir.map(|p| p.display().to_string()).unwrap_or("not initialized".to_string()));
    println!("{} Working directory: {cwd}", if std::path::Path::new(cwd).exists() { "✓" } else { "✗" });
    println!("{} Ollama: {}", if std::env::var("OLLAMA_BASE_URL").is_ok() { "✓" } else { "○" },
             std::env::var("OLLAMA_BASE_URL").unwrap_or_else(|_| "http://localhost:11434".to_string()));
}

async fn run_one_shot(
    prompt: &str,
    provider: Arc<dyn timps_providers::Provider>,
    memory: Arc<MemoryStore>,
    tools: Arc<ToolRegistry>,
) -> Result<()> {
    let mut agent = AgentBuilder::new()
        .provider(provider)
        .memory(memory)
        .opts(AgentOptions::default());
    for t in tools.all() {
        agent = agent.tool(t);
    }
    let agent = agent.build()?;

    let (tx, mut rx) = mpsc::channel(64);
    let prompt = prompt.to_string();

    let handle = tokio::spawn(async move {
        agent.run(&prompt, vec![], tx).await
    });

    // Stream output to terminal
    while let Some(event) = rx.recv().await {
        match event {
            AgentEvent::Token(t) => print!("{t}"),
            AgentEvent::ToolCallStart { name } => eprintln!("\n[tool: {name}]"),
            AgentEvent::ToolCallEnd { name, result } => {
                if result.is_error { eprintln!("[{name} error]: {}", result.content); }
            }
            AgentEvent::TurnComplete(_) => println!(),
            _ => {}
        }
    }

    handle.await??;
    Ok(())
}

async fn run_interactive(
    provider: Arc<dyn timps_providers::Provider>,
    memory: Arc<MemoryStore>,
    tools: Arc<ToolRegistry>,
) -> Result<()> {
    println!("TIMPS {} — interactive mode (Ctrl+C to exit)", env!("CARGO_PKG_VERSION"));
    println!("Provider: {}", provider.name());
    println!();

    let stdin = std::io::stdin();
    let mut history: Vec<timps_providers::Message> = vec![];

    loop {
        print!("> ");
        std::io::Write::flush(&mut std::io::stdout())?;
        let mut line = String::new();
        if stdin.read_line(&mut line)? == 0 { break; }
        let line = line.trim();
        if line.is_empty() { continue; }
        if line == "/exit" || line == "/quit" { break; }

        let mut agent = AgentBuilder::new()
            .provider(provider.clone())
            .memory(memory.clone())
            .opts(AgentOptions::default());
        for t in tools.all() {
            agent = agent.tool(t);
        }
        let agent = agent.build()?;

        let (tx, mut rx) = mpsc::channel(64);
        let prompt = line.to_string();
        let hist = history.clone();
        let handle = tokio::spawn(async move {
            agent.run(&prompt, hist, tx).await
        });

        let mut output = String::new();
        while let Some(event) = rx.recv().await {
            match event {
                AgentEvent::Token(t) => { print!("{t}"); output.push_str(&t); }
                AgentEvent::ToolCallStart { name } => eprintln!("\n  [→ {name}]"),
                _ => {}
            }
        }
        println!();
        handle.await??;

        history.push(timps_providers::Message { role: timps_providers::Role::User, content: line.to_string() });
        history.push(timps_providers::Message { role: timps_providers::Role::Assistant, content: output });
    }
    Ok(())
}
