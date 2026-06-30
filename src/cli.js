#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { runPlan } from './operator.js';

function parseArgs(argv) {
  const args = {
    plan: null,
    out: 'artifacts',
    engine: 'auto',
    headed: false,
    trace: false,
    allowLocal: false,
    allowRiskyActions: false,
    allowSecretFill: false,
    cdpEndpoint: null,
    cdpPort: null,
    timeout: 30000,
    maxSteps: 30,
    slowMo: 0
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
    } else if (token === '--plan') {
      args.plan = argv[++i];
    } else if (token === '--out') {
      args.out = argv[++i];
    } else if (token === '--engine') {
      args.engine = argv[++i];
    } else if (token === '--headed') {
      args.headed = true;
    } else if (token === '--trace') {
      args.trace = true;
    } else if (token === '--allow-local') {
      args.allowLocal = true;
    } else if (token === '--allow-risky-actions') {
      args.allowRiskyActions = true;
    } else if (token === '--allow-secret-fill') {
      args.allowSecretFill = true;
    } else if (token === '--cdp-endpoint') {
      args.cdpEndpoint = argv[++i];
    } else if (token === '--cdp-port') {
      args.cdpPort = Number(argv[++i]);
    } else if (token === '--timeout') {
      args.timeout = Number(argv[++i]);
    } else if (token === '--max-steps') {
      args.maxSteps = Number(argv[++i]);
    } else if (token === '--slow-mo') {
      args.slowMo = Number(argv[++i]);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
AI Computer Operator

Usage:
  node src/cli.js --plan examples/example-plan.json --out artifacts

Options:
  --plan <file>             JSON plan to execute
  --out <dir>               Artifact output directory
  --engine <name>           auto, browser-harness, or playwright
  --headed                  Run a visible browser when supported
  --trace                   Save Playwright trace.zip
  --cdp-endpoint <url>      Connect to an existing Chrome DevTools endpoint
  --cdp-port <port>         Expose Chromium DevTools on this port
  --allow-local             Allow localhost and private network URLs
  --allow-risky-actions     Allow high-risk action wording after approval
  --allow-secret-fill       Allow filling fields that look sensitive
  --timeout <ms>            Step timeout, default 30000
  --max-steps <n>           Max plan steps, default 30
  --slow-mo <ms>            Slow down browser actions
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.plan) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const planPath = path.resolve(args.plan);
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

  try {
    const report = await runPlan(plan, {
      outDir: args.out,
      engine: args.engine,
      headed: args.headed,
      trace: args.trace,
      allowLocal: args.allowLocal,
      allowRiskyActions: args.allowRiskyActions,
      allowSecretFill: args.allowSecretFill,
      cdpEndpoint: args.cdpEndpoint,
      cdpPort: args.cdpPort,
      timeout: args.timeout,
      maxSteps: args.maxSteps,
      slowMo: args.slowMo
    });

    console.log(JSON.stringify({
      status: report.status,
      finalUrl: report.finalUrl,
      artifacts: report.artifacts,
      report: path.resolve(args.out, 'session-report.json')
    }, null, 2));
  } catch (error) {
    const reportPath = path.resolve(args.out, 'session-report.json');
    console.error(error.message);
    if (error.validation) {
      console.error(JSON.stringify(error.validation, null, 2));
    }
    if (fs.existsSync(reportPath)) {
      console.error(`Report: ${reportPath}`);
    }
    process.exitCode = 1;
  }
}

main();
