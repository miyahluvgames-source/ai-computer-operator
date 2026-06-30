#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const expectedBrowserHarness = packageJson.config?.browserHarnessVersion || '0.1.3';

const checks = [];
addLikelyLocalBinsToPath();

function addCheck(name, status, detail, fix) {
  checks.push({ name, status, detail, fix });
}

function addLikelyLocalBinsToPath() {
  const candidates = [
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), '.cargo', 'bin')
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir) && !process.env.PATH.split(path.delimiter).includes(dir)) {
      process.env.PATH = `${dir}${path.delimiter}${process.env.PATH}`;
    }
  }
}

function command(args, options = {}) {
  let lastError = null;
  for (const executable of commandCandidates(args[0])) {
    try {
      return {
        ok: true,
        stdout: execFileSync(executable, args.slice(1), {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: options.timeout || 15000
        }).trim()
      };
    } catch (error) {
      lastError = error;
    }
  }
  if (process.platform === 'win32') {
    try {
      return {
        ok: true,
        stdout: execFileSync('cmd.exe', ['/d', '/s', '/c', shellLine(args)], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: options.timeout || 15000
        }).trim()
      };
    } catch (error) {
      lastError = error;
    }
  }
  return {
    ok: false,
    stdout: '',
    error: lastError?.stderr?.toString().trim() || lastError?.message || `Command not found: ${args[0]}`
  };
}

function shellLine(args) {
  return args.map((arg) => {
    const value = String(arg);
    if (/^[\w@%+=:,./\\-]+$/.test(value)) return value;
    return `"${value.replace(/"/g, '\\"')}"`;
  }).join(' ');
}

function shellCommand(line, options = {}) {
  const commandLine = String(line || '').trim();
  if (!commandLine) {
    return { ok: false, stdout: '', error: 'No command configured' };
  }
  try {
    return {
      ok: true,
      stdout: execSync(commandLine, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: options.timeout || 15000
      }).trim()
    };
  } catch (error) {
    return {
      ok: false,
      stdout: '',
      error: error?.stderr?.toString().trim() || error?.message || `Command failed: ${commandLine}`
    };
  }
}

function commandCandidates(commandName) {
  if (process.platform !== 'win32' || path.extname(commandName)) return [commandName];
  return [
    commandName,
    `${commandName}.exe`,
    path.join(os.homedir(), '.local', 'bin', `${commandName}.exe`),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', `${commandName}.cmd`),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', `${commandName}.exe`)
  ];
}

function semverMajor(version) {
  const match = String(version || '').match(/v?(\d+)/);
  return match ? Number(match[1]) : 0;
}

function checkNode() {
  const version = process.version;
  if (semverMajor(version) >= 20) {
    addCheck('Node.js', 'ok', version);
  } else {
    addCheck('Node.js', 'missing', `${version} found; Node 20+ is required`, 'Install Node.js 24 LTS, then rerun npm run doctor.');
  }
}

function checkNpm() {
  const result = command(['npm', '--version']);
  if (result.ok) {
    addCheck('npm', 'ok', result.stdout);
  } else {
    addCheck('npm', 'missing', 'npm is not available', 'Install Node.js with npm, then rerun npm run doctor.');
  }
}

function checkNodeModules() {
  const hasPackage = fs.existsSync(path.join(root, 'node_modules', 'playwright', 'package.json'));
  if (hasPackage) {
    addCheck('Node dependencies', 'ok', 'node_modules present');
  } else {
    addCheck('Node dependencies', 'missing', 'node_modules/playwright is missing', 'Run npm install, or npm run setup:local.');
  }
}

async function checkPlaywrightChromium() {
  try {
    const { chromium } = await import('playwright');
    const executable = chromium.executablePath();
    if (fs.existsSync(executable)) {
      addCheck('Chromium runtime', 'ok', executable);
    } else {
      addCheck('Chromium runtime', 'missing', `Expected browser executable not found: ${executable}`, 'Run npm run install:browsers, or npm run setup:local.');
    }
  } catch (error) {
    addCheck('Chromium runtime', 'missing', error.message, 'Run npm install, then npm run install:browsers.');
  }
}

function checkBrowserHarness() {
  const result = command(['browser-harness', '--version']);
  if (!result.ok) {
    addCheck('browser-harness', 'missing', 'browser-harness command is not available', 'Run npm run setup:browser-harness, or use Docker.');
    return;
  }
  const version = result.stdout.split(/\s+/).find((part) => /^\d+\.\d+\.\d+$/.test(part)) || result.stdout;
  if (version === expectedBrowserHarness) {
    addCheck('browser-harness', 'ok', version);
  } else {
    addCheck('browser-harness', 'warn', `${version} found; expected ${expectedBrowserHarness}`, 'Run npm run setup:browser-harness to install the pinned runtime version.');
  }
}

function checkDocker() {
  const result = command(['docker', '--version']);
  if (result.ok) {
    addCheck('Docker', 'ok', result.stdout);
  } else if (fs.existsSync('/.dockerenv')) {
    addCheck('Docker', 'optional', 'Running inside Docker; host Docker is not required inside the container.');
  } else {
    addCheck('Docker', 'warn', 'Docker is not available', 'Install Docker Desktop if you want the reproducible fallback runtime.');
  }
}

function checkBrowserDynamicRuntime() {
  const chromium = checks.find((check) => check.name === 'Chromium runtime');
  const browserHarness = checks.find((check) => check.name === 'browser-harness');
  if (chromium?.status === 'ok' && browserHarness?.status === 'ok') {
    addCheck('Browser dynamic runtime', 'ok', 'observeStable is available for browser pages, canvas targets, and dynamic UI inside Chromium.');
  } else {
    addCheck('Browser dynamic runtime', 'missing', 'Browser dynamic observation needs Chromium and browser-harness.', 'Run npm run setup:local, or use Docker.');
  }
}

function checkOptionalProvider(name, envName, detail, fix) {
  const configuredCommand = process.env[envName];
  if (!configuredCommand) {
    addCheck(name, 'optional', detail, fix);
    return;
  }

  const result = shellCommand(configuredCommand);
  if (result.ok) {
    const firstLine = result.stdout.split(/\r?\n/).find(Boolean);
    addCheck(name, 'ok', firstLine ? `${envName}: ${firstLine}` : `${envName}: command passed`);
  } else {
    addCheck(name, 'warn', `${envName} failed: ${result.error}`, fix);
  }
}

function printReport() {
  const wantsJson = process.argv.includes('--json');
  const status = checks.some((check) => check.status === 'missing') ? 'needs_setup'
    : checks.some((check) => check.status === 'warn') ? 'usable_with_warnings'
      : 'ready';

  const report = {
    status,
    checks,
    nextSteps: buildNextSteps(status)
  };

  if (wantsJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`AI Computer Operator doctor: ${status}`);
  console.log('');
  for (const check of checks) {
    const marker = check.status === 'ok' ? '[ok]' : check.status === 'warn' ? '[warn]' : check.status === 'optional' ? '[optional]' : '[missing]';
    console.log(`${marker} ${check.name}: ${check.detail}`);
    if (check.fix) console.log(`      fix: ${check.fix}`);
  }
  console.log('');
  console.log('Recommended options:');
  for (const step of report.nextSteps) console.log(`- ${step}`);
}

function buildNextSteps(status) {
  const steps = [];
  if (status === 'ready') {
    steps.push('Run npm run run:example:browser-harness to verify a real browser run.');
  } else {
    steps.push('Run npm run setup:local to install local Node, Chromium, and browser-harness runtime dependencies.');
    steps.push('Run npm run setup:browser-harness if only browser-harness is missing or stale.');
  }
  steps.push('Run docker build -t ai-computer-operator . when local setup is blocked or you need a clean reference environment.');
  steps.push('Run npm run verify before publishing changes.');
  return steps;
}

checkNode();
checkNpm();
checkNodeModules();
await checkPlaywrightChromium();
checkBrowserHarness();
checkBrowserDynamicRuntime();
checkDocker();
checkOptionalProvider(
  'Desktop control provider',
  'ACO_DESKTOP_PROVIDER_CHECK',
  'No desktop provider check configured. Use the host agent desktop connector or configure ACO_DESKTOP_PROVIDER_CHECK.',
  'Install a trusted desktop/computer-use provider for your OS, then set ACO_DESKTOP_PROVIDER_CHECK to its health-check command.'
);
checkOptionalProvider(
  'Host dynamic control provider',
  'ACO_DYNAMIC_PROVIDER_CHECK',
  'No host dynamic-control provider check configured. Docker covers dynamic browser targets; use this only for moving native desktop targets outside the browser container.',
  'Install a trusted host dynamic-control provider, then set ACO_DYNAMIC_PROVIDER_CHECK to its health-check command.'
);
printReport();
