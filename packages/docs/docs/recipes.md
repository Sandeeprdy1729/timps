---
sidebar_position: 5
---

# Recipes

Recipes are YAML workflow files that define multi-step agentic tasks. Each step's output is available to subsequent steps via `{step_name.output}` interpolation.

## Example

```yaml
name: code-review
description: Review staged changes
memory_context: true

steps:
  - name: get_diff
    prompt: "Run git diff --staged and return the raw diff"

  - name: review
    prompt: |
      Review this diff for bugs:
      {get_diff.output}
```

## Run a recipe

```bash
timps run workflow_recipes/code-review.yaml
```

## Built-in recipes

| Recipe | Description |
| --- | --- |
| `code-review.yaml` | Review staged/branch changes for bugs and security issues |
| `deploy-check.yaml` | Pre-deployment checklist: tests, build, env, migrations |
| `debug-session.yaml` | Systematic debugging: reproduce → isolate → fix → verify |
| `feature-plan.yaml` | Plan and scaffold a new feature with tests |

## Recipe format

```yaml
name: string              # Recipe name
description: string       # Human description
memory_context: boolean   # Inject project memories into each step

steps:
  - name: string          # Step identifier (used for {name.output} references)
    prompt: string        # Prompt template; supports {prev_step.output}
    provider: string      # Optional: override default provider for this step
    model: string         # Optional: model override
    skip_if_output_contains: string  # Skip if any previous output contains this
```

## Custom recipes

Create any `.yaml` file in `workflow_recipes/` and run it with `timps run`.

```bash
cat > workflow_recipes/my-workflow.yaml << 'EOF'
name: my-workflow
steps:
  - name: step1
    prompt: "List all TypeScript files in the project"
  - name: step2
    prompt: "For each file listed below, estimate its complexity:\n{step1.output}"
EOF

timps run workflow_recipes/my-workflow.yaml
```
