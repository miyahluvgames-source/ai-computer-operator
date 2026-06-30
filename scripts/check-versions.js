#!/usr/bin/env node
import fs from 'node:fs';
import { execSync } from 'node:child_process';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function npmView(pkg, field) {
  return execSync(`npm view ${pkg} ${field}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  }).trim();
}

function fail(message) {
  console.error(`Version check failed: ${message}`);
  process.exitCode = 1;
}

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const dockerfile = fs.readFileSync('Dockerfile', 'utf8');

const latestPlaywright = npmView('playwright', 'version');
const latestNpm = npmView('npm', 'version');

const packagePlaywright = packageJson.dependencies?.playwright;
const lockPlaywright = packageLock.packages?.['node_modules/playwright']?.version;
const dockerPlaywright = dockerfile.match(/mcr\.microsoft\.com\/playwright:v([0-9]+\.[0-9]+\.[0-9]+)-noble/)?.[1];
const dockerNpm = dockerfile.match(/ARG NPM_VERSION=([0-9]+\.[0-9]+\.[0-9]+)/)?.[1];
const packageManagerNpm = packageJson.packageManager?.match(/^npm@([0-9]+\.[0-9]+\.[0-9]+)$/)?.[1];

if (packagePlaywright !== latestPlaywright) {
  fail(`package.json playwright is ${packagePlaywright}, latest is ${latestPlaywright}`);
}

if (lockPlaywright !== latestPlaywright) {
  fail(`package-lock playwright is ${lockPlaywright}, latest is ${latestPlaywright}`);
}

if (dockerPlaywright !== latestPlaywright) {
  fail(`Dockerfile Playwright image is ${dockerPlaywright}, latest is ${latestPlaywright}`);
}

if (dockerNpm !== latestNpm) {
  fail(`Dockerfile npm is ${dockerNpm}, latest is ${latestNpm}`);
}

if (packageManagerNpm !== latestNpm) {
  fail(`packageManager npm is ${packageManagerNpm}, latest is ${latestNpm}`);
}

if (!process.exitCode) {
  console.log(JSON.stringify({
    status: 'passed',
    playwright: latestPlaywright,
    npm: latestNpm
  }, null, 2));
}
