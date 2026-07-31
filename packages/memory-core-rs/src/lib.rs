// ──────────────────────────────────────────────────────────────────────────────
// TIMPS Local AI - llama.cpp bindings and inference engine
// Provides offline LLM inference for coding assistance
// ──────────────────────────────────────────────────────────────────────────────

use std::collections::VecDeque;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::bindgen_prelude::AsyncTask;
use napi::{Env, JsFunction, Task};
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use serde_json;

// Phase 4d: Rust-native compute engine modules
mod compute;
mod gguf;
mod lsh;

mod basic_tokenizer {
    // Deterministic word/punctuation tokenizer. Not BPE — it splits on
    // whitespace and punctuation boundaries, which is a reasonable
    // approximation for English prose and code. Token IDs are FNV-1a hashes of
    // the token bytes (stable across runs and processes).

    const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
    const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

    pub fn fnv1a(bytes: &[u8]) -> u64 {
        let mut h = FNV_OFFSET;
        for b in bytes {
            h ^= *b as u64;
            h = h.wrapping_mul(FNV_PRIME);
        }
        h
    }

    fn tokenize(text: &str) -> Vec<String> {
        let mut tokens = Vec::new();
        let mut current = String::new();
        for c in text.chars() {
            if c.is_alphanumeric() || c == '\'' || c == '_' {
                current.push(c);
            } else {
                if !current.is_empty() {
                    tokens.push(std::mem::take(&mut current));
                }
                if !c.is_whitespace() {
                    tokens.push(c.to_string());
                }
            }
        }
        if !current.is_empty() {
            tokens.push(current);
        }
        tokens
    }

    /// Token text, split on whitespace/punctuation boundaries.
    pub fn tokens(text: &str) -> Vec<String> {
        tokenize(text)
    }

    pub fn count(text: &str) -> u32 {
        tokenize(text).len() as u32
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
    /// Build a `LocalModel` from a GGUF model file.
    ///
    /// Architecture fields (vocab_size, embedding_size, layers, context_size,
    /// quantization) are parsed from the real GGUF header when the file is a
    /// valid GGUF container. For non-GGUF files (or when the header is missing
    /// those keys), documented filename heuristics are used as fallback.
    pub fn from_path(path: &str) -> Option<Self> {
        let p = Path::new(path);
        if !p.exists() {
            return None;
        }

        let metadata = fs::metadata(p).ok()?;
        let size_mb = metadata.len() as f64 / 1_048_576.0;
        let name = p.file_stem()?.to_str()?.to_string();

        let gguf = gguf::read_header(p);
        let vocab_size = gguf.as_ref().and_then(|g| g.vocab_size).unwrap_or(32000);
        let embedding_size = gguf.as_ref().and_then(|g| g.embedding_size).unwrap_or(4096);
        let layers = gguf.as_ref().and_then(|g| g.block_count).unwrap_or(32);
        let context_size = gguf.as_ref().and_then(|g| g.context_length).unwrap_or(4096);
        let quantization = gguf
            .as_ref()
            .and_then(|g| g.quantization())
            .or_else(|| infer_quantization(path))
            .unwrap_or_else(|| "F16".to_string());
        let model_name = gguf
            .as_ref()
            .and_then(|g| g.name.clone())
            .unwrap_or_else(|| name.clone());

        let memory_required_mb = size_mb * 1.5;

        Some(LocalModel {
            id: format!("model_{}", name),
            name: model_name,
            path: path.to_string(),
            size_mb: (size_mb * 100.0).round() / 100.0,
            context_size,
            quantization,
            vocab_size,
            embedding_size,
            layers,
            is_loaded: false,
            memory_required_mb: (memory_required_mb * 100.0).round() / 100.0,
        })
    }
}

/// Filename-based quantization fallback for non-GGUF files or when the GGUF
/// header lacks `general.file_type`. This is a heuristic and is documented as
/// such — the GGUF header is the source of truth when available.
fn infer_quantization(path: &str) -> Option<String> {
    if path.contains("Q2_K") {
        Some("Q2_K".to_string())
    } else if path.contains("Q3_K") {
        Some("Q3_K".to_string())
    } else if path.contains("Q4_K") {
        Some("Q4_K".to_string())
    } else if path.contains("Q5_K") {
        Some("Q5_K".to_string())
    } else if path.contains("Q4_0") {
        Some("Q4_0".to_string())
    } else if path.contains("Q4_1") {
        Some("Q4_1".to_string())
    } else if path.contains("Q5_0") {
        Some("Q5_0".to_string())
    } else if path.contains("Q5_1") {
        Some("Q5_1".to_string())
    } else if path.contains("Q6_K") {
        Some("Q6_K".to_string())
    } else if path.contains("Q8_0") {
        Some("Q8_0".to_string())
    } else if path.contains("F16") || path.contains("fp16") {
        Some("F16".to_string())
    } else if path.contains("F32") || path.contains("fp32") {
        Some("F32".to_string())
    } else {
        None
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Inference Configuration
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
pub struct InferenceConfig {
    pub model_path: String,
    pub max_tokens: u32,
    pub temperature: f64,
    pub top_p: f64,
    pub top_k: u32,
    pub repeat_penalty: f64,
    pub frequency_penalty: f64,
    pub presence_penalty: f64,
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
    pub tokens_per_second: f64,
    pub finish_reason: String,
    pub model: String,
    pub logprobs: Option<Vec<f32>>,
}

impl InferenceResult {
    pub fn new(text: String, duration_ms: u64, model: &str) -> Self {
        let tokens = text.split_whitespace().count() as u32;
        let tps = if duration_ms > 0 {
            (tokens as f64 / (duration_ms as f64 / 1000.0)) * 1000.0
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

pub type StreamCallback = ThreadsafeFunction<String>;

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

        let mut loaded = model.clone();
        loaded.is_loaded = true;
        self.loaded_model = Some(loaded);

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
            None => return InferenceResult::error("No model loaded".to_string(), ""),
        };

        if !llama_cli_available() {
            return InferenceResult::error(
                "llama-cli not found on PATH — install llama.cpp (e.g. `brew install llama.cpp`) to use local inference"
                    .to_string(),
                &model.name,
            );
        }

        let mut is_busy = self.is_inferencing.lock().unwrap();
        if *is_busy {
            return InferenceResult::error("Already inferencing".to_string(), &model.name);
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

        if self.config.use_gpu {
            cmd.arg("--gpu-layers").arg("99");
        } else {
            cmd.arg("--gpu-layers").arg("0");
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
                    InferenceResult::error(err, &model.name)
                }
            }
            Err(e) => InferenceResult::error(e.to_string(), &model.name),
        }
    }

    /// Run streaming inference against a real `llama-cli` subprocess. Each
    /// output line is delivered to the JS thread through the threadsafe
    /// function as it is produced, then the full result is returned.
    pub fn infer_streaming(&mut self, prompt: &str, tsfn: &StreamCallback) -> InferenceResult {
        let model = match &self.loaded_model {
            Some(m) => m,
            None => return InferenceResult::error("No model loaded".to_string(), ""),
        };

        if !llama_cli_available() {
            return InferenceResult::error(
                "llama-cli not found on PATH — install llama.cpp (e.g. `brew install llama.cpp`) to use local inference"
                    .to_string(),
                &model.name,
            );
        }

        let mut is_busy = self.is_inferencing.lock().unwrap();
        if *is_busy {
            return InferenceResult::error("Already inferencing".to_string(), &model.name);
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
        if self.config.use_gpu {
            cmd.arg("--gpu-layers").arg("99");
        } else {
            cmd.arg("--gpu-layers").arg("0");
        }

        let mut child = match cmd.stdout(std::process::Stdio::piped()).spawn() {
            Ok(c) => c,
            Err(e) => {
                let mut guard = self.is_inferencing.lock().unwrap();
                *guard = false;
                return InferenceResult::error(e.to_string(), &model.name);
            }
        };

        let stdout = child.stdout.take().unwrap();
        let reader = BufReader::new(stdout);
        let mut full_text = String::new();

        for line in reader.lines() {
            match line {
                Ok(l) => {
                    // Deliver each streamed line to JS as it is produced.
                    // Queue size 0 = unbounded, so no tokens are dropped.
                    tsfn.call(Ok(l.clone()), ThreadsafeFunctionCallMode::NonBlocking);
                    full_text.push_str(&l);
                    full_text.push('\n');
                }
                Err(_) => break,
            }
        }

        let _ = child.wait();
        let duration_ms = start.elapsed().as_millis() as u64;

        let mut guard = self.is_inferencing.lock().unwrap();
        *guard = false;

        self.context.add_message("user", prompt);
        self.context.add_message("assistant", &full_text.trim());
        InferenceResult::new(full_text.trim().to_string(), duration_ms, &model.name)
    }
}

/// True when a real `llama-cli`/`llama` binary is available on PATH. Local
/// inference shells out to llama.cpp — this gates that call so failures are
/// reported clearly instead of a confusing `No such file or directory`.
fn llama_cli_available() -> bool {
    which::which("llama-cli").is_ok() || which::which("llama").is_ok()
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

/// Fixed embedding dimensionality for the local feature-hash embedding.
const EMBEDDING_DIM: usize = 256;

#[derive(Clone, Serialize, Deserialize)]
pub struct EmbeddingResult {
    pub embeddings: Vec<f32>,
    pub model: String,
    pub tokens: u32,
}

/// Feature-hashing embedding over word unigrams, word bigrams, and char
/// trigrams. Deterministic (FNV-1a), no external ML dependencies, and produces
/// meaningful cosine similarity: text sharing words/n-grams scores higher.
///
/// Features are hashed into `EMBEDDING_DIM` buckets with a sign bit from a
/// second hash position (the "hashing trick"), so unrelated texts have near-zero
/// cosine similarity instead of the fabricated scores the previous
/// character-bigram implementation produced.
pub fn get_embedding(text: &str) -> EmbeddingResult {
    use std::collections::HashMap;

    let mut tf: HashMap<u64, f32> = HashMap::new();

    // Normalize: keep alphanumerics + apostrophes, collapse punctuation to a
    // sentinel so punctuation-only boundaries don't merge distinct words.
    let normalized: String = text
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '\'' || c == '_' {
                c.to_ascii_lowercase()
            } else if c.is_whitespace() {
                ' '
            } else {
                '\n'
            }
        })
        .collect();

    let words: Vec<&str> = normalized.split(' ').filter(|w| !w.is_empty()).collect();

    // Word unigrams
    for w in &words {
        let h = basic_tokenizer::fnv1a(w.as_bytes());
        *tf.entry(h).or_insert(0.0) += 1.0;
    }
    // Word bigrams
    for pair in words.windows(2) {
        let feat = format!("{}~{}", pair[0], pair[1]);
        let h = basic_tokenizer::fnv1a(feat.as_bytes());
        *tf.entry(h).or_insert(0.0) += 0.5;
    }
    // Char trigrams for sub-word signal
    let joined: String = words.join(" ");
    let chars: Vec<char> = joined.chars().collect();
    if chars.len() >= 3 {
        for i in 0..=chars.len() - 3 {
            let feat: String = chars[i..i + 3].iter().collect();
            let h = basic_tokenizer::fnv1a(feat.as_bytes());
            *tf.entry(h).or_insert(0.0) += 0.25;
        }
    }

    let mut embeddings = vec![0.0f32; EMBEDDING_DIM];
    for (h, count) in tf {
        let idx = (h % EMBEDDING_DIM as u64) as usize;
        // Sign hashing: bit 33 of the hash decides the sign, reducing
        // collision noise relative to unsigned accumulation.
        let sign = if (h >> 33) & 1 == 1 { 1.0f32 } else { -1.0f32 };
        embeddings[idx] += sign * (1.0 + count.ln());
    }

    let norm: f32 = embeddings.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in &mut embeddings {
            *x /= norm;
        }
    }

    EmbeddingResult {
        embeddings,
        model: "local-feature-hash-256".to_string(),
        tokens: basic_tokenizer::count(text),
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
    llama_cli_available()
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
    temperature: f64,
    top_p: f64,
) -> String {
    let config = InferenceConfig {
        model_path: model_path.clone(),
        max_tokens,
        temperature,
        top_p,
        ..Default::default()
    };

    let mut loader = ModelLoader::new();
    loader.config = config;
    if let Err(e) = loader.load_model(&model_path) {
        return serde_json::to_string(&InferenceResult::error(e, &model_path)).unwrap();
    }

    let result = loader.infer_sync(&prompt);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Background task that runs streaming inference on the libuv threadpool,
/// delivering each output line to JS through a threadsafe function while the
/// promise is still pending (real streaming, not a post-hoc callback dump).
pub struct InferenceTask {
    model_path: String,
    prompt: String,
    max_tokens: u32,
    temperature: f64,
    tsfn: StreamCallback,
}

impl Task for InferenceTask {
    type Output = InferenceResult;
    type JsValue = String;

    fn compute(&mut self) -> napi::Result<Self::Output> {
        let config = InferenceConfig {
            model_path: self.model_path.clone(),
            max_tokens: self.max_tokens,
            temperature: self.temperature,
            ..Default::default()
        };
        let mut loader = ModelLoader::new();
        loader.config = config;
        if let Err(e) = loader.load_model(&self.model_path) {
            return Ok(InferenceResult::error(e, &self.model_path));
        }
        Ok(loader.infer_streaming(&self.prompt, &self.tsfn))
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> napi::Result<Self::JsValue> {
        Ok(serde_json::to_string(&output).unwrap_or_else(|_| "{}".to_string()))
    }
}

/// Streaming inference. Resolves a Promise<string> (JSON InferenceResult) and
/// calls `onToken(token: string)` for every line produced by the underlying
/// `llama-cli` subprocess as it is generated.
#[napi]
pub fn stream_inference(
    model_path: String,
    prompt: String,
    max_tokens: u32,
    temperature: f64,
    on_token: JsFunction,
) -> AsyncTask<InferenceTask> {
    let tsfn: StreamCallback = on_token
        .create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))
        .expect("failed to create threadsafe function for streaming");
    AsyncTask::new(InferenceTask {
        model_path,
        prompt,
        max_tokens,
        temperature,
        tsfn,
    })
}

#[napi]
pub fn get_model_info(model_path: String) -> String {
    let model = LocalModel::from_path(&model_path);
    match model {
        Some(m) => serde_json::to_string(&m).unwrap_or_else(|_| "{}".to_string()),
        None => "{}".to_string(),
    }
}

/// Download a known GGUF model from Hugging Face. Performs a real download via
/// `curl` (available on macOS/Linux) into `target_dir`, reporting the actual
/// bytes written. When the file already exists, it is reported without a
/// redundant re-download. Returns a JSON string.
#[napi]
pub fn download_model(model_id: String, target_dir: String) -> String {
    const KNOWN: [(&str, &str, &str); 4] = [
        (
            "llama-3.2-1b",
            "TheBloke/Llama-3.2-1B-Instruct-GGUF",
            "llama-3.2-1b-instruct-q4_k_m.gguf",
        ),
        (
            "phi-3.2",
            "microsoft/Phi-3.2-mini-instruct-4k",
            "Phi-3.2-mini-instruct-4k-q4_k_m.gguf",
        ),
        (
            "qwen-2",
            "Qwen/Qwen2-0.5B-Instruct-GGUF",
            "qwen2-0.5b-instruct-q4_k_m.gguf",
        ),
        (
            "gemma-2-2b",
            "google/gemma-2-2b",
            "gemma-2-2b-q4_k_m.gguf",
        ),
    ];

    let Some((repo, file)) = KNOWN
        .iter()
        .find(|(id, _, _)| *id == model_id)
        .map(|(_, repo, file)| (*repo, *file))
    else {
        return serde_json::json!({
            "error": format!(
                "Unknown model: {}. Supported: llama-3.2-1b, phi-3.2, qwen-2, gemma-2-2b",
                model_id
            )
        })
        .to_string();
    };

    let url = format!("https://huggingface.co/{}/resolve/main/{}", repo, file);
    let dir = Path::new(&target_dir);
    if let Err(e) = fs::create_dir_all(dir) {
        return serde_json::json!({
            "model_id": model_id, "url": url, "status": "error",
            "error": format!("cannot create target dir {}: {}", target_dir, e),
        })
        .to_string();
    }

    let out_path = dir.join(file);
    if out_path.exists() {
        let size = fs::metadata(&out_path).map(|m| m.len()).unwrap_or(0);
        return serde_json::json!({
            "model_id": model_id, "url": url, "status": "already_downloaded",
            "path": out_path.to_string_lossy(), "size_bytes": size,
            "size_mb": ((size as f64) / 1_048_576.0 * 100.0).round() / 100.0,
        })
        .to_string();
    }

    #[cfg(unix)]
    {
        match Command::new("curl")
            .args(["-L", "-f", "--retry", "2", "--connect-timeout", "30", "-o"])
            .arg(&out_path)
            .arg(&url)
            .status()
        {
            Ok(status) if status.success() => {
                let size = fs::metadata(&out_path).map(|m| m.len()).unwrap_or(0);
                serde_json::json!({
                    "model_id": model_id, "url": url, "status": "downloaded",
                    "path": out_path.to_string_lossy(), "size_bytes": size,
                    "size_mb": ((size as f64) / 1_048_576.0 * 100.0).round() / 100.0,
                })
                .to_string()
            }
            Ok(status) => serde_json::json!({
                "model_id": model_id, "url": url, "status": "error",
                "error": format!("curl exited with status {}", status.code().unwrap_or(-1)),
            })
            .to_string(),
            Err(e) => serde_json::json!({
                "model_id": model_id, "url": url, "status": "error",
                "error": format!("curl not available: {}", e),
            })
            .to_string(),
        }
    }
    #[cfg(not(unix))]
    {
        serde_json::json!({
            "model_id": model_id, "url": url, "status": "error",
            "error": "Automatic download is supported on macOS/Linux only. Download manually from the URL.",
        })
        .to_string()
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
    basic_tokenizer::count(&text)
}

#[napi]
pub fn truncate_to_tokens(text: String, max_tokens: u32) -> String {
    basic_tokenizer::tokens(&text)
        .into_iter()
        .take(max_tokens as usize)
        .collect::<Vec<_>>()
        .join(" ")
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
pub fn cosine_similarity_scores(a: String, b: String) -> f64 {
    let emb_a = get_embedding(&a);
    let emb_b = get_embedding(&b);
    cosine_similarity(&emb_a.embeddings, &emb_b.embeddings) as f64
}

// ──────────────────────────────────────────────────────────────────────────────
// System Info
// ──────────────────────────────────────────────────────────────────────────────

/// Read total and available physical memory in MiB from the OS. macOS uses
/// `sysctl` for total and `vm_stat` (free + inactive pages) for available;
/// Linux reads MemTotal/MemAvailable from /proc/meminfo. Values are real OS
/// measurements — no fabricated constants.
#[cfg(target_os = "macos")]
fn read_memory_mb() -> (u64, u64) {
    fn sysctl_u64(key: &str) -> Option<u64> {
        Command::new("sysctl")
            .args(["-n", key])
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .and_then(|s| s.trim().parse::<u64>().ok())
    }

    fn vm_stat_pages() -> Option<(u64, u64)> {
        let out = Command::new("vm_stat").output().ok()?;
        let text = String::from_utf8(out.stdout).ok()?;
        let mut free = 0u64;
        let mut inactive = 0u64;
        for line in text.lines() {
            let trimmed = line.trim();
            if let Some(v) = trimmed.strip_prefix("Pages free:") {
                free = v.trim().trim_end_matches('.').parse().ok()?;
            } else if let Some(v) = trimmed.strip_prefix("Pages inactive:") {
                inactive = v.trim().trim_end_matches('.').parse().ok()?;
            }
        }
        Some((free, inactive))
    }

    let total_mb = sysctl_u64("hw.memsize").map(|b| b / 1_048_576).unwrap_or(0);
    let page_size = sysctl_u64("hw.pagesize").filter(|p| *p > 0).unwrap_or(4096);
    let available_mb = vm_stat_pages()
        .map(|(free, inactive)| ((free + inactive) * page_size) / 1_048_576)
        .unwrap_or(0);
    (total_mb, available_mb)
}

/// Linux: total and available memory from /proc/meminfo (kB → MiB).
#[cfg(target_os = "linux")]
fn read_memory_mb() -> (u64, u64) {
    fn meminfo_kb(prefix: &str) -> Option<u64> {
        std::fs::read_to_string("/proc/meminfo")
            .ok()?
            .lines()
            .find(|l| l.starts_with(prefix))?
            .split_whitespace()
            .nth(1)?
            .parse()
            .ok()
    }

    let total_mb = meminfo_kb("MemTotal:").map(|kb| kb / 1024).unwrap_or(0);
    let available_mb = meminfo_kb("MemAvailable:").map(|kb| kb / 1024).unwrap_or(0);
    (total_mb, available_mb)
}

/// Other platforms: memory figures unavailable.
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn read_memory_mb() -> (u64, u64) {
    (0, 0)
}

#[napi]
pub fn get_system_info() -> String {
    let (memory_total_mb, memory_available_mb) = read_memory_mb();

    let info = serde_json::json!({
        "llama_available": is_llama_available(),
        "gpu_available": std::env::var("CUDA_VISIBLE_DEVICES").is_ok()
            || which::which("nvidia-smi").is_ok(),
        "cpu_threads": std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
        "memory_total_mb": memory_total_mb,
        "memory_available_mb": memory_available_mb,
    });

    serde_json::to_string(&info).unwrap_or_else(|_| "{}".to_string())
}