# TIMPS Changelog

All notable changes to TIMPS are documented here.

## [Unreleased]

### Added
- **Layer 9: HarmonicSheafWeaver (HSW)** — sheaf-cohomology-inspired harmonic oscillator
  layer that unifies contradiction detection, resonance propagation, and predictive
  foresight into a single differentiable structure over multi-graphs.
  - Algebraic contradiction detection via H¹ cohomology (provably catches global contradictions)
  - Eigenmode-based foresight (deterministic, O(k·N) via sparse sheaf Laplacian)
  - Phase-coherence modulated restriction maps for sheaf consistency
  - `/sheaf` CLI command with predict/contradict/status/consolidate subcommands
  - Benchmark suite: `benchmark/runners/harmonicSheafWeaver.ts`
  - CLI integration via `sheafVeil.ts` (prompt injection + tool result weaving)
- TIMPS CLI with persistent memory
- MCP server for 20+ memory tools
- VS Code extension with sidebar
- Full server with REST API

### Changed
- Improved memory architecture with 3 layers
- Enhanced tool registry system

### Fixed
- Various bug fixes

## [1.0.0] - 2024-01-15

### Added
- Initial release
- Core agent loop
- Basic integrations

[Full changelog](https://github.com/anomalyco/timps/compare/v0.9.0...v1.0.0)