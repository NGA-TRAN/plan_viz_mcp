# PNG performance

Measured on 2026-09-22 using Node 24.21.0 and bundled Playwright Chromium on macOS arm64. Each case uses one cold request followed by eight requests in the same renderer. Warm values are medians of those eight requests. Measurements include synchronous conversion and PNG rendering, but exclude the production conversion worker's startup, MCP transport, host image display, and writing the returned bytes to a file.

| Plan                             | 0.1.22, original renderer | 0.1.23, original renderer | 0.1.23, warm page | Speedup vs original |
| -------------------------------- | ------------------------: | ------------------------: | ----------------: | ------------------: |
| Sample (3 operators)             |                  246.5 ms |                  246.3 ms |            5.6 ms |                 44× |
| Wide (8 sources under Union)     |                  259.8 ms |                  256.7 ms |           16.5 ms |                 16× |
| Tall (10 filters above a source) |                  253.8 ms |                  253.8 ms |           13.7 ms |                 19× |

The dependency upgrade alone did not meaningfully improve speed. [The v0.1.23 fix](https://github.com/NGA-TRAN/plan_viz/pull/65) completes reciprocal text bindings so operator labels appear in Excalidraw exports. This also lets the browser stop requesting `repairBindings: true`. Normal Excalidraw element restoration remains in place.

The original renderer reused Chromium but created a context and page for every export. Loading the 8.1 MiB browser bundle consumed about 174–177 ms per request; drawing, loading fonts, and PNG encoding consumed another 31–43 ms. Conversion of these fixtures took less than 1 ms. Keeping the successful page alive avoids repeated bundle loading and font initialization. Each call still draws the supplied scene; PNGs and scenes are not cached.

Cold requests in the comparison took 359–383 ms across all three configurations. Initial exploratory runs included first requests around 1.4 seconds, so startup varies with OS caches and machine load. This change primarily improves subsequent requests, not Chromium startup. Keep the MCP process running between `/visualize` calls.

## Reproduce

With a supported Node version and Chromium installed:

```sh
npm ci
npm run build
BENCH_ROUNDS=9 npm run benchmark:png
```

The benchmark decodes every PNG and reports dimensions, byte counts, conversion time, browser launch, context/page creation, navigation, evaluation, cleanup, and total time as JSON. PNG validation itself is outside the timing. It starts a new renderer for each plan shape.

To compare a saved build or dependency, use absolute paths:

```sh
BENCH_ROUNDS=9 \
RENDERER_MODULE=/absolute/path/to/saved/dist/render/renderer.js \
CONVERTER_MODULE=/absolute/path/to/plan-viz-0.1.22/dist/index.js \
npm run benchmark:png
```

Keep the saved renderer's `dist/lib`, `dist/render/assets`, and resolvable dependencies alongside it. Omit `CONVERTER_MODULE` to measure the current dependency with the saved renderer; omit both overrides to measure the current implementation. Run comparisons sequentially without other browser tests running.

## Lifecycle and integration checks

Real-browser tests verify visible operator titles, bundled fonts, offline requests, one bundle load across repeated exports, changes to scene output on the reused page, cleanup on shutdown/cancellation/timeout, closed-page recovery, browser restart, image limits, and both MCP transports. JSON tests assert that text bindings are already complete before rendering.

The workspace's `.cursor/mcp.json` launches the local `dist/stdio.js` using `node` and Cursor's `${workspaceFolder}` interpolation. Ensure the host resolves Node 24, then reload the plan-viz server in Cursor after building to activate these changes. The v0.1.0 release tarball does not acquire fixes from edits to this checkout. Codex needs its own [MCP configuration](../README.md#codex-setup).

If a warm `/visualize` command still takes seconds, compare its duration with `benchmark:png`: host processing, displaying the MCP image, and saving its base64 bytes are outside these renderer timings. Interactive Cursor timing has not been measured here.
