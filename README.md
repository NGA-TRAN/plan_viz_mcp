# plan-viz-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.13-green)](https://nodejs.org/)
[![CI](https://github.com/NGA-TRAN/plan_viz_mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/NGA-TRAN/plan_viz_mcp/actions/workflows/ci.yml)

Convert DataFusion physical execution plans into editable Excalidraw diagrams or PNG images using one MCP tool: `visualize`.

The server uses the public `convertPlanToExcalidraw` API from `plan-viz`. It accepts raw indented physical plans and DataFusion EXPLAIN / EXPLAIN ANALYZE tables. It does not execute SQL, connect to a database, or save submitted plans or generated results to disk.

## Install from source

Use Node.js **24 LTS** (Node 22.13+ is also supported).

```sh
npm ci
npx playwright install chromium
npm run build
```

Chromium is needed only for `.png`. JSON output works without a browser. On Linux, use `npx playwright install --with-deps chromium` if browser system libraries are missing. Browser installation downloads executables; subsequent visualization runs use bundled assets and fonts without external network access.

## stdio

The published [v0.1.0](https://github.com/NGA-TRAN/plan_viz_mcp/releases/tag/v0.1.0) tarball is the default Cursor configuration. Add it to `.cursor/mcp.json` or an MCP host's server settings. Ensure the host's `node` executable is a supported version; use an absolute path to Node if necessary.

```json
{
  "mcpServers": {
    "plan-viz": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/NGA-TRAN/plan_viz_mcp/releases/download/v0.1.0/plan-viz-mcp-0.1.0.tgz"
      ]
    }
  }
}
```

After npm publication, `npx -y plan-viz-mcp` is equivalent. For a local checkout, build first (`npm run build`) and point the host at `dist/stdio.js`:

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
/visualize format=.excalidraw tests/fixtures/sample-plan.ts example_1.excalidraw
```

```
/visualize path/to/plan.txt
```

```
/visualize tests/join.sql example_join.png
```

```
/visualize
ProjectionExec: expr=[id, name, age]
  FilterExec: age > 18
    DataSourceExec: file_groups={1 groups: [[data.parquet]]}
```

The first and last examples write `example_1.png` and `projection-filter-datasource.png` respectively. Open `.excalidraw` results in Excalidraw or [plan-visualizer](https://nga-tran.github.io/plan-visualizer/).

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

in `structuredContent`. Parse the text with `JSON.parse`; the result has `type: "excalidraw"` and a nonempty `elements` array. The host can save the returned text as a `.excalidraw` file for editing. The server itself performs no result-file writes.

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

Large conversions run in terminable workers to keep the server responsive. PNG requests lazily start one Chromium process and use a fresh context for each export. Cancellation, timeouts, and shutdown release workers and browser contexts; a subsequent request can restart a crashed browser. No plan/result cache is retained. Chromium may create temporary runtime profiles managed by Playwright.

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
```

Build before running tests: process/worker tests exercise compiled files. `npm test` uses fake images and does not launch Chromium. `test:png` requires Chromium and fails instead of skipping when unavailable. It checks real image pixels, bundled fonts, offline rendering, both transports, crash recovery, and cancellation. CI runs fast tests on Node 22 and 24 and browser/package tests on Node 24.

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
