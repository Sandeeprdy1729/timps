//! Recipe runner — YAML workflow files for multi-step agentic tasks.
//!
//! Recipe format (YAML):
//! ```yaml
//! name: code-review
//! description: Review a PR branch for issues
//! memory_context: true   # inject semantic memories into each step
//! steps:
//!   - name: fetch_diff
//!     prompt: "Run git diff main...HEAD and summarize the changes"
//!     provider: ollama   # optional step-level override
//!   - name: review
//!     prompt: "Review the following diff for bugs and style issues:\n{fetch_diff.output}"
//!   - name: suggest_fixes
//!     prompt: "Suggest concrete code fixes for the issues found in the review:\n{review.output}"
//! ```

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::mpsc;
use crate::{AgentOptions, AgentBuilder, AgentEvent};
use timps_memory::MemoryStore;
use timps_providers::ProviderRegistry;
use timps_tools::ToolRegistry;

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize)]
pub struct Recipe {
    pub name: String,
    pub description: Option<String>,
    #[serde(default = "bool::default")]
    pub memory_context: bool,
    pub steps: Vec<RecipeStep>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RecipeStep {
    pub name: String,
    pub prompt: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    /// Skip step if previous step output contains this string
    pub skip_if_output_contains: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StepResult {
    pub name: String,
    pub output: String,
    pub skipped: bool,
}

#[derive(Debug, Serialize)]
pub struct RecipeRun {
    pub recipe_name: String,
    pub steps: Vec<StepResult>,
    pub success: bool,
}

// ── Runner ─────────────────────────────────────────────────────────────────

pub struct RecipeRunner {
    memory: Arc<MemoryStore>,
    tools: Arc<ToolRegistry>,
    providers: Arc<ProviderRegistry>,
    default_provider: String,
}

impl RecipeRunner {
    pub fn new(
        memory: Arc<MemoryStore>,
        tools: Arc<ToolRegistry>,
        providers: Arc<ProviderRegistry>,
        default_provider: String,
    ) -> Self {
        Self { memory, tools, providers, default_provider }
    }

    /// Load recipe from YAML file
    pub fn load(path: &Path) -> Result<Recipe> {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Cannot read recipe: {}", path.display()))?;
        serde_yml::from_str(&content)
            .with_context(|| format!("Invalid recipe YAML in: {}", path.display()))
    }

    /// Run all steps; later steps can reference earlier outputs via `{step_name.output}` in prompts.
    pub async fn run(
        &self,
        recipe: &Recipe,
        vars: HashMap<String, String>,
        on_event: impl Fn(AgentEvent) + Send + Sync + 'static,
    ) -> Result<RecipeRun> {
        let on_event = Arc::new(on_event);
        let mut outputs: HashMap<String, String> = vars;
        let mut step_results: Vec<StepResult> = Vec::new();

        for step in &recipe.steps {
            // Interpolate {prev_step.output} references
            let prompt = interpolate(&step.prompt, &outputs);

            // Skip logic
            if let Some(skip_str) = &step.skip_if_output_contains {
                if outputs.values().any(|v| v.contains(skip_str.as_str())) {
                    step_results.push(StepResult {
                        name: step.name.clone(),
                        output: "(skipped)".to_string(),
                        skipped: true,
                    });
                    continue;
                }
            }

            let provider_name = step.provider.as_deref()
                .unwrap_or(&self.default_provider);
            let provider = self.providers.get(provider_name)
                .with_context(|| format!("Unknown provider: {provider_name}"))?;

            let agent = AgentBuilder::new()
                .provider(provider)
                .memory(self.memory.clone())
                .opts(AgentOptions::default())
                .build()?;

            let (tx, mut rx) = mpsc::channel(64);
            let oe = on_event.clone();
            let handle = tokio::spawn(async move {
                agent.run(&prompt, vec![], tx).await
            });

            let mut output = String::new();
            while let Some(event) = rx.recv().await {
                match &event {
                    AgentEvent::Token(t) => output.push_str(t),
                    _ => {}
                }
                oe(event);
            }

            let result = handle.await??;
            let output = if output.is_empty() { result.output.clone() } else { output };

            outputs.insert(format!("{}.output", step.name), output.clone());
            step_results.push(StepResult {
                name: step.name.clone(),
                output,
                skipped: false,
            });
        }

        Ok(RecipeRun {
            recipe_name: recipe.name.clone(),
            steps: step_results,
            success: true,
        })
    }
}

/// Replace `{key}` placeholders with values from `vars`.
fn interpolate(template: &str, vars: &HashMap<String, String>) -> String {
    let mut result = template.to_string();
    for (k, v) in vars {
        result = result.replace(&format!("{{{k}}}"), v);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::interpolate;
    use std::collections::HashMap;

    #[test]
    fn test_interpolate() {
        let mut vars = HashMap::new();
        vars.insert("step1.output".to_string(), "hello world".to_string());
        let result = interpolate("Review this: {step1.output}", &vars);
        assert_eq!(result, "Review this: hello world");
    }

    #[test]
    fn test_interpolate_no_match() {
        let vars = HashMap::new();
        let result = interpolate("No vars here", &vars);
        assert_eq!(result, "No vars here");
    }
}
