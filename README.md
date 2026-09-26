# plan-viz-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.13-green)](https://nodejs.org/)
[![CI](https://github.com/NGA-TRAN/plan_viz_mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/NGA-TRAN/plan_viz_mcp/actions/workflows/ci.yml)

Convert DataFusion physical execution plans into editable Excalidraw diagrams or PNG images using one MCP tool: `visualize`.

The server uses the public `convertPlanToExcalidraw` API from `plan-viz` **0.1.23**, including its fix for missing operator labels in Excalidraw exports. It accepts raw indented physical plans and DataFusion EXPLAIN / EXPLAIN ANALYZE tables. It does not execute SQL, connect to a database, or save submitted plans or generated results to disk.

## Install from source

Use Node.js **24 LTS** (Node 22.13+ is also supported).

```sh
npm ci
npx playwright install chromium
npm run build
```

Chromium is needed only for `.png`. JSON output works without a browser. On Linux, use `npx playwright install --with-deps chromium` if browser system libraries are missing. Browser installation downloads executables; subsequent visualization runs use bundled assets and fonts without external network access.

## stdio

The published [v0.1.1](https://github.com/NGA-TRAN/plan_viz_mcp/releases/tag/v0.1.1) tarball includes the operator-label fix and PNG renderer reuse. Add it to `.cursor/mcp.json` or an MCP host's server settings. Ensure the host's `node` executable is a supported version; use an absolute path to Node if necessary.

```json
{
  "mcpServers": {
    "plan-viz": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/NGA-TRAN/plan_viz_mcp/releases/download/v0.1.1/plan-viz-mcp-0.1.1.tgz"
      ]
    }
  }
}
```

The committed Cursor configuration uses the local build and [Cursor's `${workspaceFolder}` interpolation](https://cursor.com/docs/mcp#config-interpolation), so it works regardless of the checkout location. Build first (`npm run build`) and ensure Cursor resolves Node 24. If it resolves an older version, select a supported Node installation for the host or locally set `command` to that executable's absolute path; keep personal paths out of commits.

When using the release tarball, install the matching Chromium version once for PNG output: `npx -y playwright@1.63.0 install chromium`. Excalidraw output does not need Chromium.

After npm publication, `npx -y plan-viz-mcp` can launch the published package. For other MCP hosts, use an absolute path to the local build:

```json
{
  "mcpServers": {
    "plan-viz": {
      "command": "node",
      "args": ["/absolute/path/to/plan_viz_mcp_codex/dist/stdio.js"]
    }
  }
}
```

For transport inspection, run:

```sh
npx @modelcontextprotocol/inspector node dist/stdio.js
# Noninteractive discovery:
npx @modelcontextprotocol/inspector --cli node dist/stdio.js --method tools/list
```

`npm start` is convenient for manual execution. Configure hosts to launch `node dist/stdio.js` directly so npm's own script banners cannot pollute the protocol stream. Server diagnostics go to stderr.

## Codex setup

Codex uses its own MCP configuration; the Cursor configuration and `/visualize` project command do not configure the Codex extension. After building, run this from the repository root with Node 24 selected:

```sh
codex mcp add plan-viz -- "$(node -p 'process.execPath')" "$PWD/dist/stdio.js"
codex mcp list
```

This registers the actual Node executable and absolute build path in your user-level Codex configuration. For project-only setup, merge a `[mcp_servers.plan-viz]` entry with `command` and `args` into the ignored `.codex/config.toml`, preserving other settings. See the [official Codex MCP documentation](https://developers.openai.com/codex/mcp).

Start a new Codex session after configuration and use the [plain MCP prompt](examples/README.md#plain-prompt-in-an-mcp-enabled-chat). Check that the `visualize` tool is available before requesting an export.

## Cursor command: `/visualize`

This repo ships a project command at [`.cursor/commands/visualize.md`](.cursor/commands/visualize.md). After the **plan-viz** MCP server is configured and enabled (Customize → MCP, or reload the window), type `/visualize` in Cursor Agent chat.

The command reads a DataFusion physical plan, calls the MCP `visualize` tool, and writes the result to a workspace file. It accepts:

| Input    | Meaning                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------ |
| `plan`   | Inline plan text, the current selection, or the full contents of a named `.txt` / `.sql` fixture |
| `format` | `.png` (default) or `.excalidraw`                                                                |
| `path`   | Output `.png` or `.excalidraw` file. Inferred from the path extension when `format` is omitted   |

If `path` is omitted, the command writes a kebab-case PNG named from the request (a query or plan-file basename, or the top operators, for example `projection-filter-datasource.png`) and reports that path. Do not treat a plan fixture as the output path.

```
/visualize example_1.png
ProjectionExec: expr=[id, name, age]
  FilterExec: age > 18
    DataSourceExec: file_groups={1 groups: [[data.parquet]]}
```

```
/visualize examples/plans/simple.txt examples/output/simple.excalidraw
```

```
/visualize path/to/plan.txt
```

```
/visualize examples/plans/wide.txt examples/output/wide.png
```

```
/visualize
ProjectionExec: expr=[id, name, age]
  FilterExec: age > 18
    DataSourceExec: file_groups={1 groups: [[data.parquet]]}
```

The first and last examples write `example_1.png` and `projection-filter-datasource.png` respectively. Open `.excalidraw` results in Excalidraw or [plan-visualizer](https://nga-tran.github.io/plan-visualizer/).

For ready-to-run manual tests, use the plain-text plans in [`examples/plans/`](examples/plans/) and the [copyable MCP commands](examples/README.md). Save generated files to `examples/output/`, which is ignored by Git.

## Streamable HTTP

```sh
npm run start:http
# http://127.0.0.1:3333/mcp
# Optional: PORT=4444 npm run start:http
```

```json
{
  "mcpServers": {
    "plan-viz": {
      "url": "http://127.0.0.1:3333/mcp"
    }
  }
}
```

If the host requires an explicit transport type:

```json
{
  "mcpServers": {
    "plan-viz": {
      "type": "http",
      "url": "http://127.0.0.1:3333/mcp"
    }
  }
}
```

The server binds to `127.0.0.1` and accepts POST requests only at `/mcp`. It permits Host values `127.0.0.1:<port>` and `localhost:<port>`. An Origin, if present, must be the corresponding `http://` origin on that same port. Native MCP clients may omit Origin. There is no public deployment or authentication mode in this release; do not expose this endpoint through a public proxy.

## Tool examples

Both `plan` and `format` are required. Formats are exactly `.excalidraw` and `.png`. These JSON objects are the arguments to an SDK client's `callTool` method, **not complete JSON-RPC wire messages**. Let the SDK supply protocol metadata and envelopes.

The shared sample, also used by tests, is:

```text
ProjectionExec: expr=[id, name, age]
  FilterExec: age > 18
    DataSourceExec: file_groups={1 groups: [[data.parquet]]}
```

### 1. Editable Excalidraw scene

```json
{
  "name": "visualize",
  "arguments": {
    "plan": "ProjectionExec: expr=[id, name, age]\n  FilterExec: age > 18\n    DataSourceExec: file_groups={1 groups: [[data.parquet]]}",
    "format": ".excalidraw"
  }
}
```

The successful result has `isError: false`, a text block containing the complete, pretty-printed scene JSON, and:

```json
{ "format": ".excalidraw", "mimeType": "application/json" }
```

in `structuredContent`. Parse the text with `JSON.parse`; the result has `type: "excalidraw"` and a nonempty `elements` array. The host can save the returned text as a `.excalidraw` file for editing. The server itself performs no result-file writes. A second text block contains an **Open in Excalidraw** link with the scene embedded in the URL; no upload is needed. Links are omitted if they would exceed the result-size limit. They can be long, so use the file for clients that limit URL length.

### 2. PNG image

```json
{
  "name": "visualize",
  "arguments": {
    "plan": "ProjectionExec: expr=[id, name, age]\n  FilterExec: age > 18\n    DataSourceExec: file_groups={1 groups: [[data.parquet]]}",
    "format": ".png"
  }
}
```

The successful result contains an image block with `type: "image"`, `mimeType: "image/png"`, and base64 bytes in `data`. Its `structuredContent` is:

```json
{ "format": ".png", "mimeType": "image/png" }
```

The decoded bytes are a complete PNG (signature `89 50 4E 47 0D 0A 1A 0A`). Image display and downloading depend on the host UI. This is an export of the same Excalidraw scene, not a separate layout implementation.

### 3. Validation error

```json
{
  "name": "visualize",
  "arguments": { "plan": "   ", "format": ".png" }
}
```

A blank plan, absent `format`, or unsupported format returns a tool result with `isError: true`, explanatory text, and no image. Converter and renderer failures also return safe tool errors. Malformed protocol messages and HTTP rejections retain their protocol/HTTP error semantics.

### 4. EXPLAIN table

The same tool accepts table output with a `physical_plan` row:

```text
+-------------------+--------------------------------------------------------------------+
| plan_type         | plan                                                               |
+-------------------+--------------------------------------------------------------------+
| physical_plan     | ProjectionExec: expr=[id, name, age]                               |
|                   |   FilterExec: age > 18                                             |
|                   |     DataSourceExec: file_groups={1 groups: [[data.parquet]]}       |
+-------------------+--------------------------------------------------------------------+
```

Pass the entire table as `plan` with either format. EXPLAIN ANALYZE tables using `Plan with Metrics` are also supported. Fixtures in `tests/fixtures/plans.ts` generate both variants from the shared sample. Preserve the indentation in the plan column.

## Limits and lifecycle

| Resource                       | Limit                                                                |
| ------------------------------ | -------------------------------------------------------------------- |
| Plan text                      | 512 KiB, measured as UTF-8 bytes                                     |
| HTTP body / stdio input buffer | 4 MiB                                                                |
| Serialized tool result         | 8 MiB, including base64 expansion                                    |
| Conversion                     | One active worker, four queued jobs, 5 seconds including queue wait  |
| Worker heap                    | 128 MiB old-generation heap                                          |
| PNG rendering                  | One active export, four queued jobs, 30 seconds including queue wait |
| PNG dimensions                 | 16 megapixels; maximum 16384 pixels per side                         |

Large conversions run in terminable workers to keep the server responsive. PNG requests lazily start one Chromium process and reuse its loaded page and fonts for subsequent exports. Each request renders its own scene; there is no plan/result cache. Failed, cancelled, or timed-out exports discard their context, and subsequent requests recreate it. Shutdown closes the retained context and browser; a subsequent request can restart a crashed browser. Chromium may create temporary runtime profiles managed by Playwright.

Keep the MCP server running between PNG requests to benefit from the warm renderer. The first PNG still pays for Chromium startup and loading Excalidraw. After rebuilding or changing `.cursor/mcp.json`, reload the plan-viz MCP server in Cursor once. The `/visualize` command should reuse that server for later requests.

A resource-limit error never returns a partial image. Request `.excalidraw` when the image dimensions are too large, or submit a smaller plan when conversion or result size limits are reached. Operator support and interpretation come from `plan-viz`; accepting text does not validate SQL semantics.

## Development and verification

```sh
npm run typecheck
npm run lint
npm run format:check
npm run build
npm test
npm run test:png
npm run test:package
npm run benchmark:png
```

Build before running tests: process/worker tests exercise compiled files. `npm test` uses fake images and does not launch Chromium. `test:png` requires Chromium and fails instead of skipping when unavailable. It checks real image pixels, bundled fonts, offline rendering, both transports, crash recovery, and cancellation. CI runs fast tests on Node 22 and 24 and browser/package tests on Node 24.

`benchmark:png` measures the sample, wide, and tall plans using a new browser for each plan and repeated exports within that browser. It reports the first request separately from the median of later requests. See [PNG performance measurements](docs/png-performance.md) for the dependency-only comparison and reproduction instructions. These timings use synchronous conversion and exclude production worker startup, MCP transport, host-side image display, and file saving.

`test:package` packs the build, installs it with production dependencies into a fresh temporary directory, and exercises both formats over stdio and HTTP outside the source tree. It prints the retained package artifact location. This command may access npm but never publishes anything.

The implementation uses MCP SDK 2.0.0 and its built-in compatibility path for 2025-era clients. Automated tests cover pinned `2026-07-28` and legacy client connections. See [verification.md](docs/verification.md) for the checks actually run and remaining host/UI limitations.

## Troubleshooting

- **Chromium could not start:** run `npx playwright install chromium` from the source checkout or installed package directory, using its pinned Playwright version. A restricted OS/container sandbox may also block browser launch.
- **Unsupported Node engine:** select Node 24 for both installation and the MCP host's configured executable. Shell version managers and desktop applications can resolve different Node installations.
- **HTTP 403:** use the exact loopback URL and allowed Host/Origin values; public domains and unrelated browser origins are rejected.
- **Renderer busy / timeout:** wait for the active request or reduce the plan size.
- **JSON works but no image appears:** verify `.png` using Inspector; the host must support MCP image content.

Architecture and rationale are in [docs/implementation-plan.md](docs/implementation-plan.md). The original reference is retained in [docs/plan.md](docs/plan.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [code of conduct](CODE_OF_CONDUCT.md). Security reports go through [SECURITY.md](SECURITY.md), not public issues.

## Changelog

Notable changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

MIT. See [LICENSE](LICENSE).
