# Changelog

All notable changes to the `env-checker` project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [1.0.0] - 2026-11-22

### Added

- Core environment verification engine for Node.js runtime and package manager versions.
- Zero-config `.env` vs `.env.example` disparity checking and type validation.
- Binary detection engine for verifying CLI dependencies in `$PATH`.
- TCP port availability scanner using Node `net` socket inspection.
- Subcommands: `check` (default verification), `init` (configuration bootstrap), and `sync` (template synchronization).
- CLI flags: `--dry-run`, `--json`, `--strict`, `--config`, and `--debug`.
- Graceful TTY degradation and full support for `NO_COLOR` standard.
- Cross-platform support across macOS, Linux, and Windows.
- Comprehensive Vitest test suite and type declarations.
