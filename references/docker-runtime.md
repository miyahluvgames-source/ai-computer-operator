# Docker Runtime

The Docker runtime is a complete reproducible environment for AI Computer Operator. It includes the public skill files, Node.js, Chromium, Chrome DevTools Protocol exposure, examples, tests, and a deterministic browser-plan runner.

The skill's browser automation priority is Chrome DevTools / CDP-first. The runtime uses a Node.js adapter only so the same plans can run in a portable container when a user's local machine lacks dependencies.

## Build

```bash
docker build -t ai-computer-operator .
```

This is the recommended path when local Node.js or browser dependencies are incomplete.

## Run

```bash
docker run --rm \
  -p 9222:9222 \
  -v "$PWD/artifacts:/app/artifacts" \
  ai-computer-operator \
  --plan examples/example-plan.json \
  --cdp-port 9222 \
  --out artifacts
```

## Useful Flags

| Flag | Purpose |
| --- | --- |
| `--plan <file>` | JSON plan to execute |
| `--out <dir>` | artifact output directory |
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
