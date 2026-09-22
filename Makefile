# plan-viz-mcp — local development commands
# Usage: make <target>

NPM  ?= npm
NPX  ?= npx
NODE ?= node
PORT ?= 3333

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <target>\n\n"} \
		/^[a-zA-Z0-9_-]+:.*?##/ { printf "  %-18s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

.PHONY: install
install: ## Install dependencies from the lockfile (npm ci)
	$(NPM) ci

.PHONY: playwright
playwright: ## Install Playwright Chromium (needed for PNG)
	$(NPX) playwright install chromium

.PHONY: playwright-deps
playwright-deps: ## Install Chromium plus OS libraries (Linux / CI)
	$(NPX) playwright install --with-deps chromium

.PHONY: setup
setup: install playwright ## Install dependencies and Chromium

.PHONY: build
build: ## Compile TypeScript and bundle the renderer
	$(NPM) run build

.PHONY: typecheck
typecheck: ## Type-check without emitting
	$(NPM) run typecheck

.PHONY: lint
lint: ## Run ESLint
	$(NPM) run lint

.PHONY: format
format: ## Write Prettier formatting
	$(NPM) run format

.PHONY: format-check
format-check: ## Check Prettier formatting
	$(NPM) run format:check

.PHONY: test
test: ## Fast unit/integration tests (no Chromium)
	$(NPM) test

.PHONY: test-png
test-png: ## Real PNG / Chromium integration tests
	$(NPM) run test:png

.PHONY: test-package
test-package: ## Pack and smoke-test the published layout
	$(NPM) run test:package

.PHONY: test-all
test-all: test test-png test-package ## All test suites

.PHONY: check
check: typecheck lint format-check build test ## Local verification (fast path)

.PHONY: verify
verify: check test-png test-package ## Full verification including Chromium and package

.PHONY: start
start: ## Start the stdio MCP server
	$(NPM) start

.PHONY: start-http
start-http: ## Start Streamable HTTP (PORT=3333, override with PORT=)
	PORT=$(PORT) $(NPM) run start:http

.PHONY: inspector
inspector: ## Open MCP Inspector against stdio
	$(NPX) @modelcontextprotocol/inspector $(NODE) dist/stdio.js

.PHONY: inspector-cli
inspector-cli: ## List tools via Inspector CLI
	$(NPX) @modelcontextprotocol/inspector --cli $(NODE) dist/stdio.js --method tools/list

.PHONY: ci
ci: install typecheck lint format-check build test ## CI fast-path (Node 22/24)

.PHONY: ci-png
ci-png: install playwright-deps build test-png test-package ## CI PNG and package job

.PHONY: clean
clean: ## Remove the build output
	rm -rf dist
