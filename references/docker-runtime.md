# Docker Runtime

The Docker runtime is the reproducible environment for AI Computer Operator's browser lane and browser-page dynamic checks. It includes the public skill files, Node.js, Chromium, browser-harness, Chrome DevTools Protocol exposure, browser dynamic observation, examples, tests, and a deterministic browser-plan runner.

The browser lane recommends browser-harness with Chrome DevTools Protocol. The runtime uses Node.js for plan orchestration, Chromium startup, and fallback execution so the same browser plans can run in a portable container when a user's local machine lacks dependencies.

## Build

```bash
docker build -t ai-computer-operator .
```

This is the recommended path when local Node.js or browser dependencies are incomplete.

## Local Setup Check

Run the doctor before local execution:

```bash
npm run doctor
```

The doctor reports installed and missing pieces, then suggests one of these user-selected repair commands:

```bash
npm run setup:local
npm run setup:browser-harness
npm run setup:browsers
```

Use Docker when the doctor reports a local dependency issue that is slow or risky to repair.

Browser-page dynamic control is included in Docker through `observeStable`, which samples screenshots until the page reaches a stable visual state. Use it for browser animations, canvas targets, drag-after-state checks, and dynamic page loading.

Native desktop providers and host-level dynamic-control providers are outside the Docker browser runtime. If the task needs native windows, file pickers, OS dialogs, or moving targets outside the browser container, install a host provider and configure the doctor checks described in `provider-setup.md`.

Local dynamic example:

```bash
npm run run:example:dynamic
```

## Run

```bash
docker run --rm \
  -p 9222:9222 \
  -v "$PWD/artifacts:/app/artifacts" \
  ai-computer-operator \
  --engine browser-harness \
  --plan examples/example-plan.json \
  --cdp-port 9222 \
  --out artifacts
```

## Useful Flags

| Flag | Purpose |
| --- | --- |
| `--plan <file>` | JSON plan to execute |
| `--out <dir>` | artifact output directory |
| `--engine <name>` | `auto`, `browser-harness`, or `playwright` |
| `--headed` | run a visible browser when supported |
| `--trace` | save a Playwright trace |
| `--cdp-endpoint <url>` | connect to an existing Chrome DevTools endpoint |
| `--cdp-port <port>` | expose Chromium's DevTools endpoint from the runtime |
| `--allow-local` | allow localhost and private network URLs |
| `--allow-risky-actions` | allow selectors with high-risk action words |
| `--allow-secret-fill` | allow filling fields that look like secret fields |
| `--max-steps <n>` | limit plan length |

## Artifact Output

Each run writes:

- `session-report.json`
- screenshot files
- extracted text files
- `trace.zip` when tracing is enabled

## Plan Schema

Top-level fields:

- `name`: optional run name
- `startUrl`: optional initial URL
- `viewport`: optional `{ "width": 1280, "height": 720 }`
- `steps`: required array of actions

Supported actions:

- `goto`
- `click`
- `fill`
- `press`
- `waitFor`
- `wait`
- `screenshot`
- `extractText`
- `assertText`
- `selectOption`
- `check`
- `uncheck`
- `hover`
- `setViewport`
- `observeStable`
