# Verification record

PR verification was rerun on 2026-09-22 using Node.js 24.21.0 on macOS arm64, with the fast suite also passing on Node 22.13.1. The default shell uses a different Node version; checks use isolated executables without changing the machine's global configuration.

## Completed checks

- TypeScript build and strict type checking pass.
- ESLint passes.
- Prettier formatting checks pass.
- **42 tests pass across eight suites** on Node 24: 31 fast tests and 11 real-browser tests, covering service behavior, worker/renderer lifecycle, documentation fixtures, and both transports. The same 31 fast tests also pass on Node 22.13.1.
- Modern MCP `2026-07-28` and the SDK's legacy client compatibility path pass discovery and calls over stdio and HTTP.
- Earlier verification with MCP Inspector CLI 2.7.0 discovered exactly one tool, `visualize`, with the expected schemas and annotations, and successfully called both output formats. The PR recheck uses SDK clients for discovery and both transports.
- Raw physical plans, EXPLAIN, and EXPLAIN ANALYZE fixtures convert successfully.
- All four files in `examples/plans/` pass actual stdio MCP calls for both formats. Generated PNGs decode successfully, wide/tall outputs exceed 1000 pixels in the expected direction, and Excalidraw text bindings are reciprocal. Outputs are saved under the ignored `examples/output/` folder for manual inspection.
- PNG tests decode actual images, check nonblank pixels, verify Nunito/Lilita font responses, and observe only the local in-memory renderer origin.
- Worker cancellation/deadlines, render queue saturation, cancellation cleanup, browser and individual-page crash recovery, active/queued export shutdown, and missing-browser errors are covered.
- HTTP tests cover loopback binding, Host/Origin rejection, unsupported methods, malformed JSON, and content-length/chunked request limits.
- A clean `npm ci` succeeds and reports zero known vulnerabilities with the locked dependency versions.
- The packed package installs with production dependencies in a fresh temporary directory and serves both formats over both transports outside the source checkout.
- The PR recheck visually inspected the simple and wide PNGs: operator titles, properties, arrows, and source labels are visible without clipping. Browser tests also validate operator-title pixels automatically.

## Implementation decisions supported by measurements

A synchronous conversion benchmark with 5,000 source nodes took approximately 6.6 seconds for 295 KiB of input and generated about 20 MiB of compact scene JSON. Production conversion therefore runs in a terminable worker with a five-second deadline, a bounded queue, a heap limit, and a scene-size check before transferring results back to the main process.

The SDK's built-in transport helpers handle older clients. No custom compatibility protocol or additional tools were added.

The original converter omitted reverse text bindings on containers. `plan-viz` 0.1.23 fixes these in the generated scene, so the browser no longer requests `repairBindings: true`. JSON tests check the reciprocal bindings and PNG tests check ink within each operator-title region.

PNG rendering now reuses the loaded page and fonts after successful exports. [The performance comparison](png-performance.md) measures the dependency-only upgrade separately from page reuse, with warm exports improving from roughly 247–260 ms to 6–17 ms on the supplied fixtures. First requests still incur browser startup and bundle loading. Real-browser tests cover reused-page output changes, shutdown, cancellation, timeout, and recovery.

The PR recheck ran `BENCH_ROUNDS=9 npm run benchmark:png`: cold exports took 367–379 ms, and warm medians were 5.9 ms (sample), 16.6 ms (wide), and 14.7 ms (tall). These measure conversion plus rendering, excluding MCP host display and file saving; the earlier dependency-only baseline was not rerun.

## Verification limits

- CI configuration is included but has not been executed on a remote CI runner.
- Cursor/Codex desktop image presentation has not been tested interactively. Protocol image delivery is tested; each host controls its own image display/download UI.
- The portable Cursor config requires the host to resolve Node 22.13+ (Node 24 recommended). Codex registration is a separate per-user or per-project setup step documented in the README; it is not installed by this PR.

No npm publication or public deployment was performed.
