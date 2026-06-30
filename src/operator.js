import path from 'node:path';
import { chromium } from 'playwright';
import { ensureDir, makeArtifactPath, writeJson, writeText } from './report.js';
import { validatePlan } from './safety.js';

export async function runPlan(plan, options = {}) {
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

    default:
      throw new Error(`Unsupported action: ${step.action}`);
  }
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
