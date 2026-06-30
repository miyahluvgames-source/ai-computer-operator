#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const browserHarnessVersion = packageJson.config?.browserHarnessVersion || '0.1.3';

const args = new Set(process.argv.slice(2));
const installAll = args.has('--all') || args.has('--local');
const installBrowserHarness = installAll || args.has('--browser-harness');
const installNodeDeps = installAll || args.has('--node');
const installBrowsers = installAll || args.has('--browsers');

if (!installBrowserHarness && !installNodeDeps && !installBrowsers) {
  printHelp();
  process.exit(2);
}

addLikelyUvBinToPath();

if (installNodeDeps) {
  run('npm', ['install']);
}

if (installBrowsers) {
  run('npx', ['playwright', 'install', 'chromium']);
}

if (installBrowserHarness) {
  const current = installedBrowserHarnessVersion();
  if (current === browserHarnessVersion) {
    console.log(`browser-harness ${browserHarnessVersion} is already installed.`);
  } else {
    ensureUv();
    stopBrowserHarnessDaemons();
    run('uv', ['tool', 'install', '--python', '3.12', '--force', `browser-harness==${browserHarnessVersion}`]);
    run('browser-harness', ['telemetry', 'disable'], { allowFailure: true });
  }
}

console.log('');
console.log('Setup complete. Run npm run doctor to verify the environment.');

function printHelp() {
  console.log(`AI Computer Operator setup

Usage:
  node scripts/setup-runtime.js --local
  node scripts/setup-runtime.js --browser-harness
  node scripts/setup-runtime.js --node
  node scripts/setup-runtime.js --browsers

Options:
  --local             Install Node dependencies, Chromium, and browser-harness
  --browser-harness   Install the pinned browser-harness runtime
  --node              Run npm install
  --browsers          Install Playwright Chromium
`);
}

function ensureUv() {
  if (commandExists('uv')) return;

  console.log('uv is not installed. Installing uv with the official Astral installer...');
  if (process.platform === 'win32') {
    run('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      'irm https://astral.sh/uv/install.ps1 | iex'
    ]);
  } else {
    run('sh', ['-c', 'curl -LsSf https://astral.sh/uv/install.sh | sh']);
  }

  addLikelyUvBinToPath();
  if (!commandExists('uv')) {
    throw new Error('uv installed, but the uv command is not on PATH. Restart your terminal or add the uv bin directory to PATH, then rerun setup.');
  }
}

function commandExists(command) {
  return commandCandidates(command).some((candidate) => {
    const result = spawnSync(candidate, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return result.status === 0;
  });
}

function installedBrowserHarnessVersion() {
  const output = capture('browser-harness', ['--version']);
  if (!output) return null;
  return output.split(/\s+/).find((part) => /^\d+\.\d+\.\d+$/.test(part)) || output.trim();
}

function capture(command, commandArgs) {
  for (const candidate of commandCandidates(command)) {
    const result = spawnSync(candidate, commandArgs, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: process.env
    });
    if (result.status === 0) return result.stdout.trim();
  }
  if (process.platform === 'win32') {
    const result = spawnSync(shellLine([command, ...commandArgs]), {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: process.env
    });
    if (result.status === 0) return result.stdout.trim();
  }
  return null;
}

function run(command, commandArgs, options = {}) {
  console.log(`> ${command} ${commandArgs.join(' ')}`);
  let result = null;
  if (process.platform === 'win32' && ['npm', 'npx'].includes(command)) {
    result = spawnSync(shellLine([command, ...commandArgs]), {
      cwd: root,
      stdio: 'inherit',
      shell: true,
      env: process.env
    });
  } else {
    for (const candidate of commandCandidates(command)) {
      result = spawnSync(candidate, commandArgs, {
        cwd: root,
        stdio: 'inherit',
        shell: false,
        env: process.env
      });
      if (result.status === 0 || result.error?.code !== 'ENOENT') break;
    }
  }
  if (result.status !== 0 && !options.allowFailure) {
    process.exit(result.status || 1);
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

function shellLine(args) {
  return args.map((arg) => {
    const value = String(arg);
    if (/^[\w@%+=:,./\\-]+$/.test(value)) return value;
    return `"${value.replace(/"/g, '\\"')}"`;
  }).join(' ');
}

function addLikelyUvBinToPath() {
  const candidates = process.platform === 'win32'
    ? [path.join(os.homedir(), '.local', 'bin'), path.join(os.homedir(), '.cargo', 'bin')]
    : [path.join(os.homedir(), '.local', 'bin'), path.join(os.homedir(), '.cargo', 'bin')];
  for (const dir of candidates) {
    if (fs.existsSync(dir) && !process.env.PATH.split(path.delimiter).includes(dir)) {
      process.env.PATH = `${dir}${path.delimiter}${process.env.PATH}`;
    }
  }
}

function stopBrowserHarnessDaemons() {
  if (process.platform !== 'win32') return;
  const script = "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'browser_harness\\\\.daemon' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }";
  spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    cwd: root,
    stdio: 'ignore',
    shell: false
  });
}
