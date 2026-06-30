# Task Recipes

## Public Page Check

1. Open the target URL.
2. Wait for the main content.
3. Extract the page title and key visible text.
4. Capture a screenshot.
5. Report final URL, title, and screenshot path.

## Local Web App QA

1. Confirm the local URL and expected state.
2. Open the page in a controlled browser.
3. Check for visible errors, missing text, and broken layout.
4. Capture desktop and mobile screenshots if useful.
5. Report issues with file or screenshot references.

## Form Filling

1. Confirm every field and value.
2. Fill only non-sensitive fields by default.
3. Stop before final submit unless user approved the exact submission.
4. Screenshot the pre-submit state.

## File Organization

1. List candidate files.
2. Confirm the naming, movement, or cleanup rule.
3. Avoid deletion unless explicitly requested.
4. Report changed paths and counts.

## Native App Or Desktop Window

1. Confirm the app, window, or file picker target.
2. Check that a desktop provider is available.
3. Prefer visible labels and window state over raw coordinates.
4. Stop before destructive actions or account-changing prompts.
5. Report the final window state, screenshot, or changed file path.

## Dynamic Visual Target

1. Identify what visual state should become stable or change.
2. Use `observeStable` for browser-page motion.
3. Use a host dynamic provider for moving targets outside the browser.
4. Capture before/after screenshots or a short state report.
5. Report any timing uncertainty or partial verification.

## Evidence Bundle

For completed tasks, return:

- target
- actions taken
- final state
- artifact paths
- any skipped or blocked steps
