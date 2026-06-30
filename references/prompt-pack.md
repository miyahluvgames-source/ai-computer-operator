# Prompt Pack

## Install AI Computer Operator

```text
Install AI Computer Operator from this public repository:
https://github.com/miyahluvgames-source/ai-computer-operator

If you can persist skills in this environment:
1. Clone or download the repository.
2. Install it as a skill named ai-computer-operator in the appropriate skill directory for this agent.
3. Include SKILL.md and the references folder. Do not copy .git, node_modules, artifacts, generated images, caches, or temporary outputs.
4. From the repository root, run npm run doctor.
5. If dependencies are missing, show me the available repair options first: npm run setup:local, npm run setup:browser-harness, npm run setup:browsers, or Docker.

If you cannot persist skills:
1. Load SKILL.md and the relevant references for this chat only.
2. Tell me clearly that this is a session-only setup.

Do not perform destructive, account-changing, financial, or secret-handling actions during installation.

Return:
- install mode: persistent or session-only
- installed path, if available
- doctor status
- missing providers or dependencies
- one safe test command or test task I can run next
```

## Browser Check

```text
Use AI Computer Operator to open <URL>, verify the main content, capture a screenshot, and summarize what is visible.
```

## Local App QA

```text
Use AI Computer Operator to inspect my local web app at <URL>. Check desktop and mobile layout, capture screenshots, and list visible issues with evidence.
```

## Form Review

```text
Use AI Computer Operator to fill the form fields I specify, stop before final submission, and show me the pre-submit state.
```

## File Cleanup

```text
Use AI Computer Operator to review these files, propose a cleanup plan, and wait before moving or deleting anything.
```

## Evidence Report

```text
Use AI Computer Operator to complete the approved steps, then return a short report with actions taken, final state, screenshots, and unresolved risks.
```
