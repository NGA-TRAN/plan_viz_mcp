# Visualize a DataFusion physical plan

Use the **plan-viz** MCP server from this repo (`plan_viz_mcp`). Call its `visualize` tool. Do not convert plans with other libraries, the `plan-viz` npm package directly, or a hand-written parser.

This command is for **Cursor Agent chat**. Other hosts, including the Codex extension inside Cursor, use separate MCP configuration. If invoked there without the tool, refer to the host setup in [README.md](README.md#codex-setup); changing Cursor's settings will not enable the tool in that host.

## 0) Check and configure plan_viz_mcp

Do this **before** collecting the plan or calling the tool.

A server is configured when **either**:

- The `visualize` tool from the **plan-viz** MCP is already available in this session, **or**
- [`.cursor/mcp.json`](.cursor/mcp.json) (project) or `~/.cursor/mcp.json` (user) has an `mcpServers` entry named `plan-viz` that starts this server.

### Check

1. If `visualize` from plan-viz is already in the available MCP tools, skip to **Inputs**.
   Reuse the running server across requests so PNG exports keep the renderer and fonts loaded. Do not restart or rebuild the server for each image.
2. Otherwise read [`.cursor/mcp.json`](.cursor/mcp.json) if it exists. Then read `~/.cursor/mcp.json` if it exists. Look for `mcpServers.plan-viz`.
3. Supported configurations include stdio `npx` of the [v0.1.0 release tarball](https://github.com/NGA-TRAN/plan_viz_mcp/releases/tag/v0.1.0), `npx` / `plan-viz-mcp`, `npx` / `github:NGA-TRAN/plan_viz_mcp`, or `node` (including an absolute path to Node) with args that end in `dist/stdio.js`. The local path may use Cursor's `${workspaceFolder}` variable. A loopback HTTP URL ending in `/mcp` is also supported. Preserve an existing configuration; if it fails, report the connection error instead of replacing it with another version.

### Configure if missing or invalid

1. For PNG later, Chromium must be installed (`npx playwright install chromium`); do that only if the user asked for `.png` or left format default.
2. In this source checkout, build with a supported Node version (`npm run build`) if `dist/stdio.js` is missing. Write or merge **project** [`.cursor/mcp.json`](.cursor/mcp.json), preserving every other `mcpServers` entry:

```json
{
  "mcpServers": {
    "plan-viz": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/dist/stdio.js"]
    }
  }
}
```

Outside a source checkout, the published release can be used instead. Explain that v0.1.0 does not include this checkout's PNG performance and label fixes:

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

3. Do **not** overwrite unrelated servers in `~/.cursor/mcp.json`. Only edit the user file if the user asked for a global install.
4. After writing the config, say that Cursor must enable/reload the **plan-viz** MCP (Customize → MCP, or reload the window). If `visualize` is still not available, stop and ask the user to enable it, then retry. Do not invent a fallback converter.

## Inputs

Take `plan`, `format`, and `path` from the user message, the current selection, or files they named.

- `plan` — DataFusion physical plan text, or `EXPLAIN` / `EXPLAIN ANALYZE` table text (`physical_plan` or `Plan with Metrics` rows). Inline, the current selection, or the **full contents** of a file they named.
- `format` — `".png"` or `".excalidraw"`. Default `".png"`.
- `path` — workspace-relative or absolute file to write. Always export the result to this file. This is only `.png` or `.excalidraw`.

**Plan files:** if they named a `.txt` or `.sql` file (or another plan fixture such as `.ts`), read that file and use its entire contents as `plan`. Do not treat `.txt` / `.sql` as the output `path`. If they also named a `.png` or `.excalidraw` file, that is the output `path`. If the named plan file is missing or unreadable, say so and stop. Do not invent a plan.

If they gave a path ending in `.png` or `.excalidraw` and omitted `format`, infer `format` from that extension. If they gave `format` and a path with a different extension, call the tool with `format` and still write to their path.

If `plan` is missing (no inline text, no selection, and no plan file), ask for the plan text or a `.txt` / `.sql` path. Do not invent a plan.

If `path` is missing, do **not** ask. Use the requested format, defaulting to `".png"` only when `format` is also missing, and write a workspace-relative kebab-case filename with that extension that matches the request intent:

1. Prefer a short slug from the user's wording (what they asked to visualize, a query name, or operators they named), or from the plan file's basename if they named one (`tests/tpch_q3.sql` → `tpch-q3.png`).
2. Otherwise slug the plan's operator names top-to-bottom, stripping the `Exec` suffix (for example `projection-filter-datasource.png`).
3. Use 2–4 lowercase hyphenated tokens. If that file already exists, append `-2`, `-3`, …
4. Tell the user the path you chose. Do not use generic names like `output.png` or `example.png`.

## Call the MCP tool

Call the plan-viz MCP tool `visualize` with:

- `plan`: the full plan string
- `format`: `".png"` or `".excalidraw"`

If the tool is still not available after the configure step, stop. Do not fall back to another converter.

## After the tool returns

Always write the tool result to `path`. Persist the MCP payload only — do not reconvert with `plan-viz` or a local `visualize()` call.

Create the output's parent directory if it does not exist.

- **`.png`**: decode the image content (`type: "image"`, base64 `data`) and write those bytes to `path`. Also show the image in the reply. Add a short reading note only if the user asked (arrows are streams; blue is sort order; plans read bottom-up).
- **`.excalidraw`**: write the JSON text to `path`. Tell them they can open it in Excalidraw or [plan-visualizer](https://nga-tran.github.io/plan-visualizer/).
- **`isError: true`**: quote the tool's text and stop. Do not write a file. Do not retry with a different converter.

## Examples

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

If the user omits both format and output path, write a PNG named from the intent (inline example → `projection-filter-datasource.png`; `path/to/plan.txt` → `plan.png`) and say that path in the reply. Preserve an explicitly requested format: `/visualize format=.excalidraw examples/plans/tall.txt` writes `tall.excalidraw`.
