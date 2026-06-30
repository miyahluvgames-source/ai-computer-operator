# Desktop And Dynamic Provider Setup

AI Computer Operator uses three control lanes:

- Browser lane for web pages and DOM-verifiable workflows.
- Desktop lane for native apps, file pickers, OS dialogs, and non-browser windows.
- Dynamic visual lane for moving targets, drag validation, canvas, animation, and timing-sensitive UI.

The repo includes the portable browser lane and browser-page dynamic checks. Native desktop and host-level dynamic control depend on the user's operating system, permissions, and agent platform, so this public skill validates provider availability instead of bundling one fixed provider for every machine.

## Provider Layers

| Layer | Use when | Setup path |
| --- | --- | --- |
| Browser lane | Pages, forms, screenshots, DOM checks, visible browser workflows | Use this repo's local setup or Docker runtime. |
| Browser-page dynamic checks | Browser animations, canvas targets, drag-after-state checks, dynamic page loading | Included in local setup and Docker through `observeStable`. |
| Desktop lane | Native app windows, file pickers, OS dialogs, non-browser UI, local file workflows | Install a trusted desktop/computer-use provider supported by the user's host agent. |
| Host dynamic visual lane | Moving native targets, non-browser games, high-frequency visual feedback outside the browser container | Install a trusted dynamic-control provider supported by the user's host agent. |

## Browser Runtime Setup

Use the packaged setup commands for the browser lane:

```bash
npm run doctor
npm run setup:local
npm run setup:browser-harness
npm run setup:browsers
```

Use Docker when local browser dependencies are missing or difficult to repair:

```bash
docker build -t ai-computer-operator .
docker run --rm -v "$PWD/artifacts:/app/artifacts" ai-computer-operator --engine browser-harness --plan examples/example-plan.json --out artifacts
```

## Desktop Provider Health Check

After installing a desktop provider through the user's host agent or MCP environment, expose a health-check command to the doctor.

macOS or Linux:

```bash
export ACO_DESKTOP_PROVIDER_CHECK="your-desktop-provider --health"
npm run doctor
```

Windows PowerShell:

```powershell
$env:ACO_DESKTOP_PROVIDER_CHECK="your-desktop-provider --health"
npm run doctor
```

The provider should report that it can see the active desktop session and can return a window list, screenshot, focused-app state, or equivalent visible-state check.

## Host Dynamic Provider Health Check

After installing a host dynamic-control provider for targets outside the browser container, expose a health-check command:

macOS or Linux:

```bash
export ACO_DYNAMIC_PROVIDER_CHECK="your-dynamic-provider --health"
npm run doctor
```

Windows PowerShell:

```powershell
$env:ACO_DYNAMIC_PROVIDER_CHECK="your-dynamic-provider --health"
npm run doctor
```

The provider should report that it can run a short visual loop against the host desktop, observe the target state, react to movement, and stop cleanly.

## Lane Selection

Pick by target, not by habit:

1. Use the browser lane for pages, forms, DOM state, browser screenshots, and local web apps.
2. Use browser-page dynamic checks when the page is visual, animated, canvas-based, or needs a stable visual frame before verification.
3. Use the desktop lane when the task leaves the browser or touches native windows, file pickers, app menus, or local files.
4. Use the host dynamic visual lane when the target moves, drag state matters, visual feedback is high-frequency, or static DOM/window state is not enough.
5. Use Docker when local browser dependencies are missing or a clean reference browser runtime is needed.

## Docker Boundary

Docker reproduces the browser lane and browser-page dynamic observation inside containerized Chromium. It does not normally control the host desktop, native file dialogs, or moving windows outside the container. For those tasks, install a host desktop or host dynamic provider and validate it with the environment-variable checks above.
