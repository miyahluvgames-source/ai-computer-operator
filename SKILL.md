---
name: ai-computer-operator
description: Use when a user wants an AI agent to operate a browser, inspect a webpage, interact with visible UI, manage simple desktop or file tasks, run a controlled browser automation plan, or verify computer work with screenshots, final URLs, extracted text, and state evidence.
---

# AI Computer Operator

Use this skill for public, general-purpose computer operation tasks where the agent is expected to help with browser or desktop work and verify the result.

## Core Rule

Operate only inside the user's approved task boundary. Prefer visible, reversible, evidence-producing actions. Pause before irreversible, account-changing, financial, destructive, privacy-sensitive, or high-impact steps.

## Standard Workflow

1. **Clarify scope when needed**
   - Identify the target page, app, file, or workflow.
   - Ask only if the missing detail blocks safe execution.

2. **Make a short action plan**
   - State what you will inspect or operate.
   - Identify risky steps before performing them.
   - Keep the first run small if the page or app is unfamiliar.

3. **Act visibly**
   - For browser tasks, prefer Chrome DevTools / CDP or host browser DOM tools first.
   - Prefer semantic selectors, visible labels, and DOM/state reads over raw coordinates.
   - Use Playwright only as a runtime adapter or fallback when direct DevTools tools are unavailable.
   - Do not continue after unexpected dialogs, permission prompts, login walls, payment pages, or destructive confirmations without user approval.

4. **Verify**
   - Confirm the final state through visible text, final URL, screenshot, exported file, logs, or structured report.
   - If verification is partial, say exactly what was verified and what remains uncertain.

5. **Return concise evidence**
   - Summarize actions taken.
   - Include artifact paths or screenshots when available.
   - Report blocked steps without hiding the reason.

## Safety Boundaries

Default to **do not proceed** for:

- purchases, trades, withdrawals, transfers, staking, swaps, or financial commitments
- deleting files, closing accounts, changing permissions, or removing data
- sending messages, emails, comments, posts, or form submissions on behalf of the user
- entering passwords, API keys, seed phrases, private keys, payment details, or identity documents
- bypassing access controls, rate limits, CAPTCHAs, paywalls, or terms of service
- actions that may affect another person's account, device, data, or reputation

Proceed only after explicit user approval for the exact action and target. Even then, keep the action narrow and verify the result.

## Evidence Requirements

For browser tasks, collect at least one of:

- final URL
- visible text snapshot
- screenshot
- button or status state
- exported report or file path

For desktop or file tasks, collect at least one of:

- target file path
- created or modified file list
- preview screenshot
- command output
- checksum, size, or timestamp when useful

## Docker Runtime

This repository includes a complete Docker runtime for repeatable browser checks. Use it when the user's local machine is missing dependencies, when a reproducible execution environment is needed, or when the task can be expressed as a JSON plan.

The browser automation priority remains Chrome DevTools / CDP-first. The Docker image packages Chromium with a CDP endpoint and uses the included Node.js adapter only to make the runtime portable.

Common commands:

```bash
docker build -t ai-computer-operator .
docker run --rm -p 9222:9222 -v "$PWD/artifacts:/app/artifacts" ai-computer-operator --plan examples/example-plan.json --cdp-port 9222 --out artifacts
```

Local Node.js:

```bash
npm install
node src/cli.js --plan examples/example-plan.json --out artifacts
```

Read `references/docker-runtime.md` only when the user asks for Docker usage, local setup, or deterministic browser plan execution.

## Plan Pattern

Use a JSON plan for deterministic browser tasks:

```json
{
  "name": "Check a public page",
  "startUrl": "https://example.com",
  "steps": [
    { "action": "goto", "url": "https://example.com" },
    { "action": "assertText", "selector": "body", "contains": "Example Domain" },
    { "action": "screenshot", "name": "example-home.png", "fullPage": true }
  ]
}
```

For more recipes, read `references/task-recipes.md`.

## Output Style

Be direct:

- What I did
- What I verified
- Artifacts
- Blockers or remaining risk

Do not claim completion based only on a tool success response. Verify the visible result.
