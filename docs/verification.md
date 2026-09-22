# Verification record

Local verification uses Node.js 24.21.0 on macOS arm64. The default shell uses a different Node version; tests are run with an isolated Node 24 executable without changing the machine's global configuration.

## Completed checks

- TypeScript build and strict type checking pass.
- ESLint passes.
- Prettier formatting checks pass.
- **35 tests pass across eight suites**, covering service behavior, worker/renderer lifecycle, documentation fixtures, both transports, and real Chromium integration.
- Modern MCP `2026-07-28` and the SDK's legacy client compatibility path pass discovery and calls over stdio and HTTP.
- MCP Inspector CLI 2.7.0 discovers exactly one tool, `visualize`, with the expected schemas and annotations, and successfully calls both output formats.
- Raw physical plans, EXPLAIN, and EXPLAIN ANALYZE fixtures convert successfully.
- PNG tests decode actual images, check nonblank pixels, verify Nunito/Lilita font responses, and observe only the local in-memory renderer origin.
- Worker cancellation/deadlines, render queue saturation, cancellation cleanup, browser crash recovery, and missing-browser errors are covered.
- HTTP tests cover loopback binding, Host/Origin rejection, unsupported methods, malformed JSON, and content-length/chunked request limits.
- Dependency installation reports zero known vulnerabilities after compatible transitive overrides and test-runner updates.
- The packed package installs with production dependencies in a fresh temporary directory and serves both formats over both transports outside the source checkout.
- A sample PNG was visually inspected: operator titles, properties, arrows, and the source label are visible without clipping.

## Implementation decisions supported by measurements

A synchronous conversion benchmark with 5,000 source nodes took approximately 6.6 seconds for 295 KiB of input and generated about 20 MiB of compact scene JSON. Production conversion therefore runs in a terminable worker with a five-second deadline, a bounded queue, a heap limit, and a scene-size check before transferring results back to the main process.

The SDK's built-in transport helpers handle older clients. No custom compatibility protocol or additional tools were added.

Visual inspection found that the converter omits reverse text bindings on containers. Excalidraw's `restoreElements(..., { repairBindings: true })` resolves these during browser import. PNG tests check ink within each operator-title region to catch this regression, in addition to image decoding and general nonblank-image checks.

## Verification limits

- CI configuration is included but has not been executed on a remote CI runner.
- Cursor/Codex desktop image presentation has not been tested interactively. Protocol image delivery is tested; each host controls its own image display/download UI.

No npm publication or public deployment was performed.
