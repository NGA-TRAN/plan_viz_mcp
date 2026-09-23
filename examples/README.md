# Manual MCP examples

Store physical execution plans as plain text in [`plans/`](plans/). These are illustrative inputs; the MCP does not run SQL or read the referenced Parquet files.

| File                               | What to check                                                |
| ---------------------------------- | ------------------------------------------------------------ |
| [`simple.txt`](plans/simple.txt)   | Operator titles, details, arrows, and the data source label  |
| [`wide.txt`](plans/wide.txt)       | Eight branches under a Union, with no horizontal clipping    |
| [`tall.txt`](plans/tall.txt)       | Ten filters, with no vertical clipping                       |
| [`explain.txt`](plans/explain.txt) | DataFusion EXPLAIN table input; should match the simple plan |

## Setup

Use Node 24 and build the server from the repository root:

```sh
npm ci
npm run build
mkdir -p examples/output
```

Select Node 24 with your version manager before running these commands (for example, `nvm use` with the repository's `.nvmrc`). Cursor's MCP process must also resolve a supported Node executable; see [host setup](../README.md#stdio).

For PNG, Chromium must be installed once using this project's Playwright version:

```sh
npx playwright install chromium
```

The project's `.cursor/mcp.json` points at the local build. Enable/reload **plan-viz** in Cursor after building. Reuse the running server for subsequent exports so the PNG renderer stays warm.

## Commands in Cursor Agent chat

Run these in chat from this workspace. `/visualize` reads the entire input file, calls the MCP `visualize` tool, and saves the returned result. The output extension selects the format.

This is a **Cursor Agent chat command**, not a terminal command. Codex uses separate MCP configuration, even when its extension runs inside Cursor; follow the [Codex setup](../README.md#codex-setup) and use the plain prompt below there.

PNG:

```text
/visualize examples/plans/simple.txt examples/output/simple.png
```

Editable Excalidraw:

```text
/visualize examples/plans/simple.txt examples/output/simple.excalidraw
```

More cases:

```text
/visualize examples/plans/wide.txt examples/output/wide.png
```

```text
/visualize examples/plans/tall.txt examples/output/tall.png
```

```text
/visualize examples/plans/tall.txt examples/output/tall.excalidraw
```

```text
/visualize examples/plans/explain.txt examples/output/explain.excalidraw
```

Any plan supports either output extension. You can also pass an explicit format:

```text
/visualize format=.excalidraw examples/plans/wide.txt examples/output/wide.excalidraw
```

## Plain prompt in an MCP-enabled chat

```text
Read the full contents of examples/plans/tall.txt. Call the plan-viz MCP
visualize tool with that text and format=".excalidraw". Save the returned
JSON to examples/output/tall.excalidraw, creating the output folder if needed.
Use the MCP result without converting the plan yourself.
```

For PNG, replace the format with `".png"` and the output path with `examples/output/tall.png`; ask the agent to decode and save the returned image bytes. If the chat cannot see the MCP tool, enable it in that host before retrying.

## Adding and inspecting plans

Open PNGs in the editor and `.excalidraw` files in Excalidraw. Generated files under `examples/output/` are ignored by Git. To add your own case, create another `.txt` file in `examples/plans/`, preserving the plan's indentation, and substitute its path in a command above.

To compare a first PNG with a warm export, run the simple PNG command twice without restarting the MCP. Chat response time also includes reading input, handling the image, and saving the output; `npm run benchmark:png` measures the renderer separately.
