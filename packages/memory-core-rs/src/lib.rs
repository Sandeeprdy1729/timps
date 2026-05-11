// ──────────────────────────────────────────────────────────────────────────────
// TIMPS Local AI - llama.cpp bindings and inference engine
// Provides offline LLM inference for coding assistance
// ──────────────────────────────────────────────────────────────────────────────

use std::collections::VecDeque;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::Path;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use napi_derive::napi;
use serde::{Deserialize, Serialize};

mod tokenizer {
    // Simple BPE tokenizer (simplified - in production use proper implementation)
    pub fn encode(text: &str) -> Vec<i32> {
        text.split_whitespace()
            .map(|s| s.len() as i32)
            .collect()
    }

    pub fn decode(tokens: &[i32]) -> String {
        tokens.iter().map(|t| t.to_string()).collect::<Vec<_>>().join(" ")
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Model Management
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
pub struct LocalModel {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size_mb: f64,
    pub context_size: u32,
    pub quantization: String,
    pub vocab_size: u32,
    pub embedding_size: u32,
    pub layers: u32,
    pub is_loaded: bool,
    pub memory_required_mb: f64,
}

impl LocalModel {
    pub fn from_path(path: &str) -> Option<Self> {
        let p = Path::new(path);
        if !p.exists() {
            return None;
        }

        let metadata = fs::metadata(p).ok()?;
        let size_mb = metadata.len() as f64 / 1_048_576.0;
        let name = p.file_stem()?.to_str()?.to_string();
        
        let (quantization, context_size) = if path.contains("Q2_K") {
            ("Q2_K", 2048)
        } else if path.contains("Q3_K") {
            ("Q3_K", 3072)
        } else if path.contains("Q4_0") {
            ("Q4_0", 2048)
        } else if path.contains("Q4_K") {
            ("Q4_K", 4096)
        } else if path.contains("Q5") {
            ("Q5_K", 4096)
        } else if path.contains("Q6") {
            ("Q6_K", 4096)
        } else if path.contains("Q8") {
            ("Q8_0", 4096)
        } else {
            ("F16", 4096)
        };

        let memory_required_mb = size_mb * 1.5;

        Some(LocalModel {
            id: format!("model_{}", name),
            name: name.clone(),
            path: path.to_string(),
            size_mb: (size_mb * 100.0).round() / 100.0,
            context_size,
            quantization: quantization.to_string(),
            vocab_size: 32000,
            embedding_size: 4096,
            layers: if quantization.starts_with("Q") { 32 } else { 40 },
            is_loaded: false,
            memory_required_mb: (memory_required_mb * 100.0).round() / 100.0,
        })
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Inference Configuration
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
pub struct InferenceConfig {
    pub model_path: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub top_p: f32,
    pub top_k: u32,
    pub repeat_penalty: f32,
    pub frequency_penalty: f32,
    pub presence_penalty: f32,
    pub context_window: u32,
    pub threads: u32,
    pub use_gpu: bool,
    pub cache_prompt: bool,
}

impl Default for InferenceConfig {
    fn default() -> Self {
        Self {
            model_path: String::new(),
            max_tokens: 512,
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            context_window: 4096,
            threads: 4,
            use_gpu: true,
            cache_prompt: true,
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Inference Result
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
pub struct InferenceResult {
    pub text: String,
    pub tokens: u32,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub duration_ms: u64,
    pub tokens_per_second: f32,
    pub finish_reason: String,
    pub model: String,
    pub logprobs: Option<Vec<f32>>,
}

impl InferenceResult {
    pub fn new(text: String, duration_ms: u64, model: &str) -> Self {
        let tokens = text.split_whitespace().count() as u32;
        let tps = if duration_ms > 0 {
            (tokens as f32 / (duration_ms as f32 / 1000.0)) * 1000.0
        } else {
            0.0
        };

        Self {
            text,
            tokens,
            prompt_tokens: 0,
            completion_tokens: tokens,
            duration_ms,
            tokens_per_second: tps,
            finish_reason: "stop".to_string(),
            model: model.to_string(),
            logprobs: None,
        }
    }

    pub fn error(message: String, model: &str) -> Self {
        Self {
            text: format!("Error: {}", message),
            tokens: 0,
            prompt_tokens: 0,
            completion_tokens: 0,
            duration_ms: 0,
            tokens_per_second: 0.0,
            finish_reason: "error".to_string(),
            model: model.to_string(),
            logprobs: None,
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Chat Message
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

impl ChatMessage {
    pub fn user(content: &str) -> Self {
        Self {
            role: "user".to_string(),
            content: content.to_string(),
        }
    }

    pub fn assistant(content: &str) -> Self {
        Self {
            role: "assistant".to_string(),
            content: content.to_string(),
        }
    }

    pub fn system(content: &str) -> Self {
        Self {
            role: "system".to_string(),
            content: content.to_string(),
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Chat Context
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
pub struct ChatContext {
    pub messages: Vec<ChatMessage>,
    pub system_prompt: Option<String>,
    pub max_history: u32,
}

impl Default for ChatContext {
    fn default() -> Self {
        Self {
            messages: Vec::new(),
            system_prompt: Some(
                "You are TIMPS, an AI coding assistant that helps with software development. 
You have persistent memory and remember patterns and conventions from past sessions.
Provide helpful, accurate responses focused on code and technical content.".to_string(),
            ),
            max_history: 10,
        }
    }
}

impl ChatContext {
    pub fn add_message(&mut self, role: &str, content: &str) {
        self.messages.push(ChatMessage {
            role: role.to_string(),
            content: content.to_string(),
        });

        while self.messages.len() > self.max_history as usize * 2 {
            self.messages.remove(0);
        }
    }

    pub fn to_prompt(&self) -> String {
        let mut prompt = String::new();

        if let Some(ref system) = self.system_prompt {
            prompt.push_str(&format!("system: {}\n\n", system));
        }

        for msg in &self.messages {
            prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
        }

        prompt.push_str("assistant: ");
        prompt
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Streaming Callback
// ──────────────────────────────────────────────────────────────────────────────

pub type StreamCallback = Box<dyn Fn(String) + Send + Sync>;

pub struct StreamHandler {
    callbacks: Vec<Arc<Mutex<Box<dyn Fn(String) + Send + Sync>>>>,
}

impl StreamHandler {
    pub fn new() -> Self {
        Self {
            callbacks: Vec::new(),
        }
    }

    pub fn add_callback(&mut self, callback: Box<dyn Fn(String) + Send + Sync>) {
        self.callbacks.push(Arc::new(Mutex::new(callback)));
    }

    pub fn emit(&self, token: String) {
        for cb in &self.callbacks {
            if let Ok(callback) = cb.lock() {
                callback(token.clone());
            }
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Model Loader
// ─────────────────────────────────────────────────────────────────���─���──────────

pub struct ModelLoader {
    loaded_model: Option<LocalModel>,
    config: InferenceConfig,
    context: ChatContext,
    is_inferencing: Arc<Mutex<bool>>,
}

impl ModelLoader {
    pub fn new() -> Self {
        Self {
            loaded_model: None,
            config: InferenceConfig::default(),
            context: ChatContext::default(),
            is_inferencing: Arc::new(Mutex::new(false)),
        }
    }

    pub fn load_model(&mut self, path: &str) -> Result<LocalModel, String> {
        let model = LocalModel::from_path(path)
            .ok_or_else(|| format!("Failed to load model from {}", path))?;

        self.loaded_model = Some(LocalModel {
            is_loaded: true,
            ..model
        });

        Ok(model)
    }

    pub fn unload_model(&mut self) {
        self.loaded_model = None;
    }

    pub fn get_model(&self) -> Option<&LocalModel> {
        self.loaded_model.as_ref()
    }

    pub fn is_loaded(&self) -> bool {
        self.loaded_model.as_ref().map(|m| m.is_loaded).unwrap_or(false)
    }

    pub fn set_system_prompt(&mut self, prompt: &str) {
        self.context.system_prompt = Some(prompt.to_string());
    }

    pub fn infer_sync(&mut self, prompt: &str) -> InferenceResult {
        let model = match &self.loaded_model {
            Some(m) => m,
            None => return InferenceResult::error("No model loaded", ""),
        };

        let is_busy = self.is_inferencing.lock().unwrap();
        if *is_busy {
            return InferenceResult::error("Already inferencing", &model.name);
        }
        *is_busy = true;
        drop(is_busy);

        let start = Instant::now();
        let mut full_prompt = self.context.to_prompt();
        full_prompt.push_str(prompt);

        let mut cmd = Command::new("llama-cli");
        cmd.arg("-m").arg(&model.path)
           .arg("-p").arg(&full_prompt)
           .arg("-n").arg(self.config.max_tokens.to_string())
           .arg("--temp").arg(self.config.temperature.to_string())
           .arg("--top-p").arg(self.config.top_p.to_string())
           .arg("--top-k").arg(self.config.top_k.to_string())
           .arg("--repeat-penalty").arg(self.config.repeat_penalty.to_string())
           .arg("-c").arg(self.config.context_window.to_string());

        if self.config.threads > 0 {
            cmd.arg("-t").arg(self.config.threads.to_string());
        }

        if !self.config.use_gpu {
            cmd.arg("--no-mmap");
        }

        let output = cmd.output();
        let duration_ms = start.elapsed().as_millis() as u64;

        let mut is_inferencing = self.is_inferencing.lock().unwrap();
        *is_inferencing = false;

        match output {
            Ok(out) => {
                if out.status.success() {
                    let text = String::from_utf8_lossy(&out.stdout).to_string().trim().to_string();
                    self.context.add_message("user", prompt);
                    self.context.add_message("assistant", &text);
                    InferenceResult::new(text, duration_ms, &model.name)
                } else {
                    let err = String::from_utf8_lossy(&out.stderr).to_string();
                    InferenceResult::error(&err, &model.name)
                }
            }
            Err(e) => InferenceResult::error(&e.to_string(), &model.name),
        }
    }

    pub fn infer_streaming(&mut self, prompt: &str, callbacks: &StreamHandler) -> InferenceResult {
        let result = self.infer_sync(prompt);
        callbacks.emit(result.text.clone());
        result
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Prompt Templates
// ──────────────────────────────────────────────────────────────────────────────

pub struct PromptTemplate {
    name: String,
    template: String,
    variables: Vec<String>,
}

impl PromptTemplate {
    pub fn code_review() -> Self {
        Self {
            name: "code_review".to_string(),
            template: r#"Review the following code for the PR:

## Changes
{diff}

## Context
{context}

Provide a review with:
1. Security issues
2. Performance concerns  
3. Code quality suggestions
4. Best practices violations

Be specific and provide actionable feedback."#.to_string(),
            variables: vec!["diff".to_string(), "context".to_string()],
        }
    }

    pub fn code_explain() -> Self {
        Self {
            name: "code_explain".to_string(),
            template: r#"Explain the following code:

```{language}
{code}
```

Provide:
1. Overall purpose
2. Key components
3. How it works
4. Any notable patterns used"#.to_string(),
            variables: vec!["language".to_string(), "code".to_string()],
        }
    }

    pub fn code_refactor() -> Self {
        Self {
            name: "code_refactor".to_string(),
            template: r#"Refactor the following code to be cleaner and more maintainable:

```{language}
{code}
```

Goals:
1. Improve readability
2. Follow best practices
3. Reduce complexity
4. Add comments where helpful

Provide the refactored code with explanations."#.to_string(),
            variables: vec!["language".to_string(), "code".to_string()],
        }
    }

    pub fn generate_tests() -> Self {
        Self {
            name: "generate_tests".to_string(),
            template: r#"Generate unit tests for the following code:

```{language}
{code}
```

Use {framework} testing framework. Cover:
1. Happy path
2. Edge cases
3. Error conditions

Provide only the test code."#.to_string(),
            variables: vec!["language".to_string(), "code".to_string(), "framework".to_string()],
        }
    }

    pub fn generate_docs() -> Self {
        Self {
            name: "generate_docs".to_string(),
            template: r#"Generate documentation for:

```{language}
{code}
```

Include:
1. Overview
2. Parameters
3. Return value
4. Examples"#.to_string(),
            variables: vec!["language".to_string(), "code".to_string()],
        }
    }

    pub fn apply(&self, variables: &std::collections::HashMap<String, String>) -> String {
        let mut result = self.template.clone();
        for (key, value) in variables {
            result = result.replace(&format!("{{{}}}", key), value);
        }
        result
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Embeddings
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
pub struct EmbeddingResult {
    pub embeddings: Vec<f32>,
    pub model: String,
    pub tokens: u32,
}

pub fn get_embedding(text: &str) -> EmbeddingResult {
    let tokens = tokenizer::encode(text);
    let dim = 4096;
    let mut embeddings = vec![0.0f32; dim];
    
    for (i, token) in tokens.iter().take(dim).enumerate() {
        let val = (*token as f32 / 1000.0).sin();
        embeddings[i] = val;
    }

    EmbeddingResult {
        embeddings,
        model: "local".to_string(),
        tokens: tokens.len() as u32,
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Similarity
// ──────────────────────────────────────────────────────────────────────────────

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if mag_a == 0.0 || mag_b == 0.0 {
        return 0.0;
    }

    dot / (mag_a * mag_b)
}

// ───────────────────────────────────────────────────────────��─��────────────────
// Context Window Management
// ──────────────────────────────────────────────────────────────────────────────

pub struct ContextWindow {
    tokens: VecDeque<String>,
    max_tokens: u32,
}

impl ContextWindow {
    pub fn new(max_tokens: u32) -> Self {
        Self {
            tokens: VecDeque::new(),
            max_tokens,
        }
    }

    pub fn add(&mut self, text: &str) {
        let new_tokens: Vec<String> = text.split_whitespace().map(String::from).collect();
        
        for token in new_tokens {
            self.tokens.push_back(token);
            while self.tokens.len() > self.max_tokens as usize {
                self.tokens.pop_front();
            }
        }
    }

    pub fn to_string(&self) -> String {
        self.tokens.iter().cloned().collect::<Vec<_>>().join(" ")
    }

    pub fn clear(&mut self) {
        self.tokens.clear();
    }

    pub fn tokens(&self) -> usize {
        self.tokens.len()
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// NAPI Exports
// ──────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn is_llama_available() -> bool {
    which::which("llama-cli").is_ok() 
        || which::which("llama").is_ok() 
        || std::path::Path::new("./models").exists()
}

#[napi]
pub fn list_local_models() -> String {
    let models_dir = std::path::Path::new("./models");
    if !models_dir.is_dir() {
        return "[]".to_string();
    }

    let models: Vec<LocalModel> = fs::read_dir(models_dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let path = e.path();
                    matches!(
                        path.extension().and_then(|s| s.to_str()),
                        Some("gguf") | Some("bin") | Some("ggml")
                    )
                })
                .filter_map(|e| {
                    let path = e.path();
                    LocalModel::from_path(&path.to_string_lossy())
                })
                .collect()
        })
        .unwrap_or_default();

    serde_json::to_string(&models).unwrap_or_else(|_| "[]".to_string())
}

#[napi]
pub fn run_inference(
    model_path: String,
    prompt: String,
    max_tokens: u32,
    temperature: f32,
    top_p: f32,
) -> String {
    let config = InferenceConfig {
        model_path: model_path.clone(),
        max_tokens,
        temperature,
        top_p,
        ..Default::default()
    };

    let mut loader = ModelLoader::new();
    if let Err(e) = loader.load_model(&model_path) {
        return serde_json::to_string(&InferenceResult::error(&e, &model_path)).unwrap();
    }

    let result = loader.infer_sync(&prompt);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

#[napi]
pub fn stream_inference(
    model_path: String,
    prompt: String,
    max_tokens: u32,
    temperature: f32,
) -> String {
    run_inference(model_path, prompt, max_tokens, temperature, 0.9)
}

#[napi]
pub fn get_model_info(model_path: String) -> String {
    let model = LocalModel::from_path(&model_path);
    match model {
        Some(m) => serde_json::to_string(&m).unwrap_or_else(|_| "{}".to_string()),
        None => "{}".to_string(),
    }
}

#[napi]
pub fn download_model(model_id: String, target_dir: String) -> String {
    let models: std::collections::HashMap<String, &str> = [
        ("llama-3.2-1b", "TheBloke/Llama-3.2-1B-Instruct-GGUF"),
        ("phi-3.2", "microsoft/Phi-3.2-mini-instruct-4k"),
        ("qwen-2", "Qwen/Qwen2-0.5B-Instruct-GGUF"),
        ("gemma-2", "google/gemma-2-2b"),
    ].iter().cloned().collect();

    match models.get(&model_id) {
        Some(repo) => {
            format!(
                "Please download manually:\n\
                1. Visit: https://huggingface.co/{}\n\
                2. Download GGUF file\n\
                3. Move to: ./models/",
                repo
            )
        }
        None => format!("Unknown model: {}", model_id),
    }
}

#[napi]
pub fn read_file_context(path: String, max_lines: u32) -> String {
    let file = match fs::File::open(&path) {
        Ok(f) => f,
        Err(e) => return format!("{{\"error\":\"{}\"}}", e),
    };

    let lines: Vec<String> = BufReader::new(file)
        .lines()
        .filter_map(|l| l.ok())
        .collect();

    let max = max_lines as usize;
    let start = lines.len().saturating_sub(max);
    let selected: Vec<&str> = lines[start..].iter().map(|s| s.as_str()).collect();

    format!(
        "{{\"content\":{},\"lines\":{}}}",
        serde_json::to_string(&selected.join("\n")).unwrap_or_else(|_| "[]".to_string()),
        lines.len()
    )
}

#[napi]
pub fn extract_code_context(dir: String, file_limit: u32) -> String {
    let path = std::path::Path::new(&dir);
    if !path.is_dir() {
        return "[]".to_string();
    }

    let extensions = ["ts", "tsx", "js", "jsx", "rs", "go", "py", "java", "c", "cpp", "h"];
    
    let files: Vec<String> = fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let p = e.path();
                    p.extension()
                        .and_then(|ex| ex.to_str())
                        .map(|ex| extensions.contains(&ex))
                        .unwrap_or(false)
                })
                .take(file_limit as usize)
                .filter_map(|e| {
                    let p = e.path();
                    fs::read_to_string(&p).ok().map(|content| {
                        let lines = content.lines().count();
                        format!(
                            "{{\"file\":\"{}\",\"lines\":{}}}",
                            p.to_string_lossy(),
                            lines
                        )
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    serde_json::to_string(&files).unwrap_or_else(|_| "[]".to_string())
}

#[napi]
pub fn extract_code_snippets(dir: String, max_files: u32) -> String {
    let path = std::path::Path::new(&dir);
    if !path.is_dir() {
        return "[]".to_string();
    }

    let extensions = ["ts", "tsx", "js", "jsx", "rs", "go", "py"];
    
    let files: Vec<String> = fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let p = e.path();
                    p.extension()
                        .and_then(|ex| ex.to_str())
                        .map(|ex| extensions.contains(&ex))
                        .unwrap_or(false)
                })
                .take(max_files as usize)
                .filter_map(|e| {
                    let p = e.path();
                    let filename = p.file_name()?.to_str()?.to_string();
                    let content = fs::read_to_string(&p).ok()?;
                    
                    let snippets: Vec<String> = content
                        .lines()
                        .collect::<Vec<_>>()
                        .windows(5)
                        .filter(|window| window.iter().any(|l| l.contains("fn ") || l.contains("function ") || l.contains("def ")))
                        .take(3)
                        .map(|w| w.join("\n"))
                        .collect();

                    if snippets.is_empty() {
                        None
                    } else {
                        Some(format!(
                            "{{\"file\":\"{}\",\"snippets\":{}}}",
                            filename,
                            serde_json::to_string(&snippets).unwrap_or_else(|_| "[]".to_string())
                        ))
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    serde_json::to_string(&files).unwrap_or_else(|_| "[]".to_string())
}

// ──────────────────────────────────────────────────────────────────────────────
// Token counting
// ──────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn count_tokens(text: String) -> u32 {
    tokenizer::encode(&text).len() as u32
}

#[napi]
pub fn truncate_to_tokens(text: String, max_tokens: u32) -> String {
    let tokens: Vec<String> = tokenizer::encode(&text)
        .iter()
        .take(max_tokens as usize)
        .enumerate()
        .map(|(i, _)| {
            text.split_whitespace().nth(i).unwrap_or("").to_string()
        })
        .collect();

    tokens.join(" ")
}

// ──────────────────────────────────────────────────────────────────────────────
// Embeddings
// ──────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn get_text_embedding(text: String) -> String {
    let result = get_embedding(&text);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

#[napi]
pub fn cosine_similarity_scores(a: String, b: String) -> f32 {
    let emb_a = get_embedding(&a);
    let emb_b = get_embedding(&b);
    cosine_similarity(&emb_a.embeddings, &emb_b.embeddings)
}

// ──────────────────────────────────────────────────────────────────────────────
// System Info
// ──────────────────────────────────────────────────────────────────────────────

#[napi]
pub fn get_system_info() -> String {
    let info = serde_json::json!({
        "llama_available": is_llama_available(),
        "gpu_available": std::env::var("CUDA_VISIBLE_DEVICES").is_ok(),
        "cpu_threads": std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
        "memory_total_mb": 0u64,
        "memory_available_mb": 0u64,
    });
    
    serde_json::to_string(&info).unwrap_or_else(|_| "{}".to_string())
}