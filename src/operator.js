import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { isBrowserHarnessAvailable, runPlanWithBrowserHarness } from './browser-harness-runner.js';
import { ensureDir, makeArtifactPath, writeJson, writeText } from './report.js';
import { validatePlan } from './safety.js';

export async function runPlan(plan, options = {}) {
  const engine = normalizeEngine(options.engine);
  if (engine === 'browser-harness') {
    return runPlanWithBrowserHarness(plan, options);
  }

  if (engine === 'auto' && await isBrowserHarnessAvailable()) {
    return runPlanWithBrowserHarness(plan, options);
  }

  return runPlanWithPlaywright(plan, options);
}

async function runPlanWithPlaywright(plan, options = {}) {
  const outDir = path.resolve(options.outDir || 'artifacts');
  ensureDir(outDir);

  const validation = validatePlan(plan, options);
  if (!validation.ok) {
    const error = new Error(`Plan validation failed:\n- ${validation.errors.join('\n- ')}`);
    error.validation = validation;
    throw error;
  }

  const browser = await createBrowser(options);
  const context = await createContext(browser, plan, options);

  if (options.trace) {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }

  const page = context.pages()[0] || await context.newPage();
  await page.setViewportSize(normalizeViewport(plan.viewport));
  const report = {
    name: plan.name || 'AI Computer Operator run',
    engine: 'playwright',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'running',
    finalUrl: null,
    warnings: validation.warnings,
    steps: [],
    artifacts: []
  };

  try {
    if (plan.startUrl) {
      await page.goto(plan.startUrl, {
        waitUntil: 'domcontentloaded',
        timeout: Number(options.timeout || 30000)
      });
    }

    for (const [index, step] of plan.steps.entries()) {
      const result = await runStep(page, step, index, outDir, options);
      report.steps.push(result);
      if (result.artifact) report.artifacts.push(result.artifact);
    }

    report.status = 'passed';
    report.finalUrl = page.url();
    return report;
  } catch (error) {
    report.status = 'failed';
    report.error = {
      message: error.message,
      name: error.name
    };
    report.finalUrl = page.url();
    throw Object.assign(error, { report });
  } finally {
    report.finishedAt = new Date().toISOString();
    if (options.trace) {
      const tracePath = path.join(outDir, 'trace.zip');
      await context.tracing.stop({ path: tracePath });
      report.artifacts.push(tracePath);
    }
    writeJson(path.join(outDir, 'session-report.json'), report);
    await browser.close();
  }
}

function normalizeEngine(engine) {
  const value = String(engine || 'auto').toLowerCase();
  if (!['auto', 'browser-harness', 'playwright'].includes(value)) {
    throw new Error(`Unsupported engine: ${engine}. Use auto, browser-harness, or playwright.`);
  }
  return value;
}

async function createBrowser(options) {
  if (options.cdpEndpoint) {
    return chromium.connectOverCDP(options.cdpEndpoint);
  }

  const args = [];
  if (options.cdpPort) {
    args.push(`--remote-debugging-port=${Number(options.cdpPort)}`);
    args.push('--remote-debugging-address=0.0.0.0');
  }

  return chromium.launch({
    headless: !options.headed,
    slowMo: Number(options.slowMo || 0),
    args
  });
}

async function createContext(browser, plan, options) {
  if (options.cdpEndpoint) {
    const existing = browser.contexts()[0];
    if (existing) {
      return existing;
    }
  }

  return browser.newContext({
    viewport: normalizeViewport(plan.viewport)
  });
}

async function runStep(page, step, index, outDir, options) {
  const startedAt = new Date().toISOString();
  const base = {
    index,
    action: step.action,
    startedAt,
    finishedAt: null,
    status: 'passed'
  };

  const timeout = Number(step.timeout || options.timeout || 30000);

  switch (step.action) {
    case 'goto': {
      const response = await page.goto(step.url, {
        waitUntil: step.waitUntil || 'domcontentloaded',
        timeout
      });
      return finish(base, {
        url: page.url(),
        httpStatus: response ? response.status() : null
      });
    }

    case 'click':
      await page.locator(step.selector).first().click({ timeout });
      return finish(base, { selector: step.selector });

    case 'fill':
      await page.locator(step.selector).first().fill(step.value, { timeout });
      return finish(base, { selector: step.selector, filled: true });

    case 'press':
      await page.keyboard.press(step.key);
      return finish(base, { key: step.key });

    case 'waitFor':
      await page.locator(step.selector).first().waitFor({
        state: step.state || 'visible',
        timeout
      });
      return finish(base, { selector: step.selector, state: step.state || 'visible' });

    case 'wait':
      await page.waitForTimeout(Number(step.ms || 1000));
      return finish(base, { ms: Number(step.ms || 1000) });

    case 'screenshot': {
      const screenshotPath = makeArtifactPath(outDir, step.name || `screenshot-${index}.png`, `screenshot-${index}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: Boolean(step.fullPage) });
      return finish(base, { artifact: screenshotPath });
    }

    case 'extractText': {
      const text = await page.locator(step.selector).first().innerText({ timeout });
      const textPath = makeArtifactPath(outDir, step.name || `text-${index}.txt`, `text-${index}.txt`);
      writeText(textPath, `${text}\n`);
      return finish(base, { selector: step.selector, artifact: textPath, chars: text.length });
    }

    case 'assertText': {
      const text = await page.locator(step.selector).first().innerText({ timeout });
      if (!text.includes(step.contains)) {
        throw new Error(`Expected text not found in ${step.selector}: ${step.contains}`);
      }
      return finish(base, { selector: step.selector, contains: step.contains });
    }

    case 'selectOption':
      await page.locator(step.selector).first().selectOption(step.value, { timeout });
      return finish(base, { selector: step.selector, value: step.value });

    case 'check':
      await page.locator(step.selector).first().check({ timeout });
      return finish(base, { selector: step.selector });

    case 'uncheck':
      await page.locator(step.selector).first().uncheck({ timeout });
      return finish(base, { selector: step.selector });

    case 'hover':
      await page.locator(step.selector).first().hover({ timeout });
      return finish(base, { selector: step.selector });

    case 'setViewport':
      await page.setViewportSize(normalizeViewport(step.viewport || step));
      return finish(base, { viewport: normalizeViewport(step.viewport || step) });

    case 'observeStable': {
      const result = await observeStable(page, step, index, outDir, options, timeout);
      return finish(base, result);
    }

    default:
      throw new Error(`Unsupported action: ${step.action}`);
  }
}

async function observeStable(page, step, index, outDir, options, timeout) {
  const intervalMs = Number(step.intervalMs || 250);
  const stableMs = Number(step.stableMs || 1000);
  const fullPage = step.fullPage !== false;
  const deadline = Date.now() + timeout;
  let lastHash = null;
  let stableSince = null;
  let samples = 0;
  let finalBuffer = null;

  if (step.selector) {
    await page.locator(step.selector).first().waitFor({
      state: step.state || 'visible',
      timeout
    });
  }

  while (Date.now() <= deadline) {
    finalBuffer = await page.screenshot({ fullPage });
    const hash = createHash('sha256').update(finalBuffer).digest('hex');
    samples += 1;

    if (hash === lastHash) {
      stableSince ??= Date.now();
      if (Date.now() - stableSince >= stableMs) {
        const artifact = makeArtifactPath(outDir, step.name || `stable-${index}.png`, `stable-${index}.png`);
        await page.screenshot({ path: artifact, fullPage });
        return {
          selector: step.selector || null,
          artifact,
          samples,
          stableMs,
          intervalMs,
          hash: hash.slice(0, 16)
        };
      }
    } else {
      lastHash = hash;
      stableSince = Date.now();
    }

    await page.waitForTimeout(intervalMs);
  }

  const artifact = makeArtifactPath(outDir, step.name || `unstable-${index}.png`, `unstable-${index}.png`);
  if (finalBuffer) {
    await fsWriteFile(artifact, finalBuffer);
  } else {
    await page.screenshot({ path: artifact, fullPage });
  }
  throw new Error(`Page did not reach a stable visual state within ${timeout}ms. Last screenshot: ${artifact}`);
}

async function fsWriteFile(filePath, data) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(filePath, data);
}

function normalizeViewport(viewport) {
  const width = Number(viewport?.width || 1280);
  const height = Number(viewport?.height || 720);
  return { width, height };
}

function finish(base, extra = {}) {
  return {
    ...base,
    ...extra,
    finishedAt: new Date().toISOString()
  };
}
