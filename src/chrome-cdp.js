import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

export async function launchCdpChrome(options = {}) {
  const port = Number(options.cdpPort || await getFreePort());
  const userDataDir = path.resolve(options.userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'aco-chrome-')));
  const executablePath = options.executablePath || chromium.executablePath();
  const args = [
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-features=Translate,OptimizationGuideModelDownloading'
  ];

  if (!options.headed) {
    args.push('--headless=new');
    args.push('--no-sandbox');
  }

  args.push('about:blank');

  const proc = spawn(executablePath, args, {
    stdio: ['ignore', 'ignore', 'pipe']
  });

  let stderr = '';
  proc.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const endpoint = `http://127.0.0.1:${port}`;
  try {
    await waitForCdp(endpoint, Number(options.timeout || 10000));
  } catch (error) {
    proc.kill('SIGTERM');
    throw new Error(`Could not start Chromium CDP endpoint: ${error.message}${stderr ? `\n${stderr}` : ''}`);
  }

  return {
    endpoint,
    port,
    userDataDir,
    async close() {
      if (!proc.killed) proc.kill('SIGTERM');
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 2000);
        proc.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  };
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error('Could not allocate a local port.'));
      });
    });
    server.on('error', reject);
  });
}

async function waitForCdp(endpoint, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/json/version`, {
        signal: AbortSignal.timeout(1500)
      });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error('Timed out waiting for CDP.');
}
