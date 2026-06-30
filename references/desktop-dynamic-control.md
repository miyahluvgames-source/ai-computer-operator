# Desktop And Dynamic Control

AI Computer Operator uses browser automation for web pages, but the desktop and dynamic visual lanes are the broader computer-control layers. They are designed for tasks where DOM access is incomplete, unavailable, or not enough to verify the real user-visible result.

## Control Principle

Both lanes follow the same evidence-first loop:

1. Observe the visible state.
2. Decide the smallest safe next action.
3. Act through an approved provider.
4. Observe again.
5. Stop when the result is verified or the risk boundary changes.

The skill should not continue just because a command returned success. It should prove the outcome through visible text, screenshots, window state, file paths, exported reports, or another user-verifiable artifact.

## Plugin And Dependency Model

AI Computer Operator is provider-agnostic. It does not require one fixed desktop plugin, because desktop permissions and automation bridges differ by agent platform and operating system.

Included in this repository:

- skill instructions and safety policy
- browser JSON plan runner
- Chromium runtime through Playwright
- browser-harness integration
- Chrome DevTools Protocol support
- `observeStable` for browser-page dynamic checks
- Dockerfile and Docker Compose for reproducible browser runtime
- doctor checks for local runtime, Docker, desktop provider, and dynamic provider

Provided by the user's host agent when needed:

- desktop/computer-use connector for native windows and OS dialogs
- dynamic-control connector for high-frequency visual feedback loops
- optional MCP-style server or local automation bridge that exposes desktop or dynamic-control capabilities
- OS permissions for screen capture, accessibility, input control, and automation

This split keeps the browser runtime reproducible while allowing each user to plug in the desktop and dynamic provider that works on their machine.

## Desktop Lane

The desktop lane handles native UI that is outside a normal browser DOM.

### How It Works

A host desktop provider supplies the agent with a controlled bridge to the user's desktop session.

Minimum provider capabilities:

- visible-state observation: screenshot, active window, window list, focused app, or accessibility tree when available
- input actions: click, double-click, type, hotkey, scroll, drag, and pointer movement
- UI targeting: visible labels, window titles, element bounds, or stable coordinates when semantic labels are unavailable
- file and app context: selected file path, open dialog state, save dialog state, or changed file list
- stop and confirmation behavior for unexpected prompts, permission dialogs, destructive actions, or account-changing screens

The skill provides routing, safety policy, prompt patterns, and doctor checks. The actual desktop bridge is supplied by the user's host agent or a trusted desktop/computer-use connector.

### Dependencies And Permissions

Desktop control normally requires:

- a host desktop provider or computer-use connector
- permission to view the screen
- permission to send mouse and keyboard input
- OS-specific accessibility or automation permissions
- a health-check command exposed through `ACO_DESKTOP_PROVIDER_CHECK`

Common OS permission categories:

| OS | Typical permission categories |
| --- | --- |
| macOS | Accessibility, Screen Recording, Input Monitoring, Automation |
| Windows | Desktop session access, UI automation access, screen capture, input control |
| Linux | Display server access, screen capture, accessibility APIs, input control |

The doctor does not install a provider automatically. It reports whether a configured provider can answer a health check and gives the user a clear next step when it is missing.

### Good Desktop-Lane Fits

| Situation | Why the desktop lane helps |
| --- | --- |
| File picker or save dialog | Browser DOM tools usually cannot inspect native dialogs. |
| Native app setup | The target is outside the browser and needs window-state verification. |
| Local file organization | The result is a changed file list, path, timestamp, or preview. |
| Export workflows | The agent can verify exported files after clicking through a native dialog. |
| Multi-window work | The agent can confirm the active window before acting. |
| Browser extension or permission prompt | The visible prompt may sit outside the page DOM. |

## Dynamic Visual Lane

The dynamic visual lane is for targets where a single static read is not enough.

### How It Works

The lane uses a short visual feedback loop:

1. Capture the current frame.
2. Detect whether the target state is visible, moving, stable, or changed.
3. Perform a small action such as wait, move, drag, click, or keypress.
4. Capture another frame.
5. Compare the before/after state.
6. Continue only while the task remains approved and the action is reversible.

For browser pages, this repo includes `observeStable`. It repeatedly samples browser screenshots, hashes frames, waits until the visual output stays unchanged for the requested stable window, and writes the final screenshot as evidence. If the page never stabilizes before timeout, it writes the last screenshot and fails loudly.

For non-browser targets, the host agent needs a dynamic-control provider that can run the same observe-act-observe style loop against the real desktop.

### Dependencies And Provider Requirements

Browser-page dynamic checks are included through:

- Chromium
- browser-harness or the Playwright fallback runner
- `observeStable`
- screenshot artifact output

Host-level dynamic control requires:

- a host dynamic-control provider
- high-frequency screenshot or frame observation
- pointer and keyboard control
- drag and timing support
- a way to stop the loop cleanly
- a health-check command exposed through `ACO_DYNAMIC_PROVIDER_CHECK`

### Good Dynamic-Lane Fits

| Situation | Why the dynamic lane helps |
| --- | --- |
| Drag-and-drop validation | The result depends on pointer motion and final drop state. |
| Canvas or WebGL UI | DOM selectors may not expose the actual object state. |
| Animated dashboards | The page needs to settle before evidence is meaningful. |
| Map or chart interactions | The useful state is visual, not just textual. |
| Video or timeline controls | The agent must wait for frame/state changes. |
| Game-like UI | The target moves or reacts to timing-sensitive input. |
| Remote desktop or streamed apps | The agent sees pixels rather than DOM elements. |

## Provider Contract

A compatible provider should support this practical contract:

| Capability | Desktop provider | Dynamic provider |
| --- | --- | --- |
| Health check | Required | Required |
| Screenshot or frame capture | Required | Required |
| Window or target state | Required when available | Optional but useful |
| Mouse and keyboard input | Required | Required |
| Drag support | Useful | Required for drag workflows |
| High-frequency loop | Optional | Required |
| Clean stop behavior | Required | Required |
| Evidence output | Required | Required |

Health checks:

```bash
export ACO_DESKTOP_PROVIDER_CHECK="your-desktop-provider --health"
export ACO_DYNAMIC_PROVIDER_CHECK="your-dynamic-provider --health"
npm run doctor
```

Windows PowerShell:

```powershell
$env:ACO_DESKTOP_PROVIDER_CHECK="your-desktop-provider --health"
$env:ACO_DYNAMIC_PROVIDER_CHECK="your-dynamic-provider --health"
npm run doctor
```

## Routing Examples

| Task | Recommended lane |
| --- | --- |
| Check a public webpage headline | Browser lane |
| Fill a non-sensitive web form and stop before submit | Browser lane |
| Wait for a chart animation to stop before screenshot | Browser-page dynamic check |
| Choose a local file in a native picker | Desktop lane |
| Export a PDF from a native app | Desktop lane |
| Drag a block on a canvas until it snaps into place | Dynamic visual lane |
| Operate a streamed remote app | Host dynamic visual lane |

## Boundaries

Desktop and dynamic control should remain conservative.

- Do not bypass CAPTCHAs, access controls, paywalls, or rate limits.
- Do not enter secrets, seed phrases, private keys, payment details, or identity documents by default.
- Do not perform purchases, trades, withdrawals, transfers, account changes, destructive actions, or public posting without exact approval.
- Do not keep acting after an unexpected permission prompt, login wall, destructive confirmation, or privacy-sensitive screen.
- Do not claim success without visible evidence.

Docker can reproduce browser automation and browser-page dynamic observation. It does not normally control native windows, OS file dialogs, or moving targets outside the container. For those tasks, use a host desktop or host dynamic provider.
