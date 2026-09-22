# Contributing to plan-viz-mcp

Thanks for helping improve this project. By participating you agree to follow the [code of conduct](CODE_OF_CONDUCT.md).

## Development setup

Use Node.js **24 LTS** (Node 22.13+ is also supported). From a clone:

```sh
npm ci
npx playwright install chromium
npm run build
```

On Linux, use `npx playwright install --with-deps chromium` if browser system libraries are missing. Chromium is required only for `.png` output and `npm run test:png`.

`make setup` installs dependencies and Chromium. `make help` lists the other local targets.

## Checks

Run the fast path before opening a pull request:

```sh
npm run typecheck
npm run lint
npm run format:check
npm run build
npm test
```

`make check` runs the same sequence. Build before tests: process and worker suites exercise compiled files.

Also run these when your change touches PNG rendering, packaging, or transports:

```sh
npm run test:png
npm run test:package
```

`make verify` runs the full set. `npm test` uses fake images and does not launch Chromium. `test:png` requires Chromium and fails instead of skipping when the browser is unavailable.

## Pull requests

1. Open an issue first for larger changes so the approach can be discussed.
2. Keep the change focused. Update [README.md](README.md) when behavior, limits, or host configuration change.
3. Add or update tests for new behavior and error paths.
4. Record user-visible changes under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md).
5. Use [Conventional Commits](https://www.conventionalcommits.org/) in the pull request title, for example `fix: reject blank EXPLAIN tables` or `docs: document HTTP Host checks`.

Do not add extra MCP tools, execute SQL, persist submitted plans, or expose the HTTP server beyond loopback.

## Reporting security issues

Do not file a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
