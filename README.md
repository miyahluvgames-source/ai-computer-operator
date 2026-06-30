# AI Computer Operator

![AI Computer Operator cover](assets/ai-computer-operator-cover.png)

**AI Computer Operator** is a public, general-purpose skill for turning plain-language computer tasks into safe, visible, and verifiable browser or desktop work.

It is designed for agents that can operate browsers, inspect pages, manage local files, or run a controlled automation runtime. The core idea is simple:

> Plan first. Act only within user-approved scope. Verify with visible evidence.

## Automation Priority

The skill is **Chrome DevTools / CDP-first** for browser automation.

1. Use the host agent's Chrome DevTools or browser DOM tools when available.
2. Use semantic browser controls and visible state checks next.
3. Use the Docker runtime when the user lacks local dependencies or wants an isolated reproducible environment.
4. Use Playwright only as the bundled adapter inside the Docker/runtime path, or as a fallback when direct DevTools tools are unavailable.

This keeps the public skill aligned with visible browser verification while still giving users a one-command Docker path when their local setup is missing dependencies.

## What It Helps With

| Use case | What the skill does |
| --- | --- |
| Web page checks | Open pages, inspect visible content, compare expected text, capture screenshots. |
| Browser workflows | Fill simple forms, click approved UI controls, wait for page states, export evidence. |
| File and document tasks | Open or organize user-provided files when the host agent has file access. |
| Visual verification | Confirm results through screenshots, extracted text, final URLs, and state reports. |
| QA routines | Run repeatable checks for landing pages, docs, dashboards, or local web apps. |

## Safety Model

This skill is intentionally conservative.

- No hidden browsing or background account actions.
- No irreversible action without explicit user approval.
- No financial actions, trading, withdrawals, purchases, or account changes by default.
- No secret handling unless the user explicitly provides a safe runtime and confirms the scope.
- No local/private network access in the Docker runtime unless enabled with `--allow-local`.
- Every meaningful run should end with a visible verification artifact.

## Repository Contents

```text
.
├── SKILL.md                    # Public skill instructions for AI agents
├── agents/openai.yaml          # Skill Hub display metadata
├── references/                 # Safety model, recipes, prompt pack
├── src/                        # Docker-friendly Chromium/CDP runtime
├── tests/                      # Lightweight safety and schema tests
├── examples/                   # Example browser automation plans
├── assets/                     # Skill card and README visuals
├── Dockerfile                  # Container runtime
└── docker-compose.yml          # Local run helper
```

## Quick Start: Use As A Skill

Copy or install the `SKILL.md` folder into your agent's skill directory, then ask:

```text
Use AI Computer Operator to open this page, confirm the main headline, take a screenshot, and tell me what changed.
```

The agent should:

1. Restate the task boundary.
2. Identify risks before acting.
3. Execute only the approved steps.
4. Return evidence: screenshot path, final URL, visible text, or a short report.

## Quick Start: Docker Runtime

The included Docker image is a complete reproducible runtime for this skill. It packages:

- the public `SKILL.md` and references
- Node.js runtime
- Chromium browser
- Chrome DevTools Protocol exposure
- a deterministic browser-plan runner
- examples and tests

Use Docker when a user's machine is missing browser automation dependencies or when you want an isolated execution environment.

Build:

```bash
docker build -t ai-computer-operator .
```

Run the example plan:

```bash
docker run --rm \
  -p 9222:9222 \
  -v "$PWD/artifacts:/app/artifacts" \
  ai-computer-operator \
  --plan examples/example-plan.json \
  --cdp-port 9222 \
  --out artifacts
```

With Docker Compose:

```bash
docker compose run --rm --service-ports operator --plan examples/example-plan.json --cdp-port 9222 --out artifacts
```

The runtime writes:

- `session-report.json`
- screenshots
- extracted text files
- optional Playwright trace files

## Example Plan

```json
{
  "name": "Example Domain check",
  "startUrl": "https://example.com",
  "steps": [
    { "action": "goto", "url": "https://example.com" },
    { "action": "assertText", "selector": "body", "contains": "Example Domain" },
    { "action": "screenshot", "name": "example-home.png", "fullPage": true },
    { "action": "extractText", "selector": "body", "name": "example-home-text.txt" }
  ]
}
```

## Runtime Actions

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

Risky selectors or labels such as delete, withdraw, transfer, buy, sell, purchase, payment, and submit are blocked unless the runtime is explicitly started with a risky-action override.

## Why Playwright Appears In The Runtime

The public workflow is DevTools-first. The package uses Playwright only as a practical Node.js adapter to launch or connect to Chromium/CDP in environments where the host agent does not already provide a DevTools lane. It is not the preferred public automation priority.

## Local Development

```bash
npm install
npm run install:browsers
npm test
npm run lint
node src/cli.js --plan examples/example-plan.json --out artifacts
```

If browser dependencies are missing or hard to install locally, use the Docker path instead. The Docker image packages Chromium and the runtime dependencies.

## Skill Hub Card Copy

**AI Computer Operator**  
Turn approved browser and desktop tasks into safe, visible, step-by-step actions with screenshots and state checks.

Chips: `No API key` · `User-approved actions` · `Evidence-first`

## License

MIT
