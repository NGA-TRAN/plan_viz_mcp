# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-09-22

### Fixed

- Pin `plan-viz` to 0.1.23 to preserve operator labels in exported scenes without browser binding repair.

### Changed

- Reuse the loaded Chromium page and fonts after successful PNG exports. Discard failed or cancelled contexts and recreate them for later requests.
- Point the workspace's Cursor MCP configuration at the local build with portable workspace paths so it uses these changes.

### Added

- `npm run benchmark:png` reports cold and warm PNG timings, including conversion, browser setup, bundle loading, and rendering.
- Four manual plan examples with PNG/Excalidraw commands, ignored output files, and separate Cursor and Codex setup instructions.

## [0.1.0] - 2026-09-21

### Added

- MCP server with one tool, `visualize`, that converts DataFusion physical plans into Excalidraw scenes or PNG images.
- Support for raw indented physical plans and DataFusion EXPLAIN / EXPLAIN ANALYZE tables.
- stdio transport and loopback Streamable HTTP at `/mcp`.
- Conversion workers, render queue, and resource limits so large or cancelled jobs cannot stall the process.
- Offline Playwright Chromium PNG export using bundled renderer assets and fonts.
- Cursor `/visualize` project command.
- CI on Node.js 22 and 24, plus Chromium and packed-package smoke tests on Node 24.

[Unreleased]: https://github.com/NGA-TRAN/plan_viz_mcp/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/NGA-TRAN/plan_viz_mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/NGA-TRAN/plan_viz_mcp/releases/tag/v0.1.0
