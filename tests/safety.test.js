import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRiskyTerm, isPrivateHost, looksSecretLike, validatePlan } from '../src/safety.js';

test('accepts a simple public page plan', () => {
  const result = validatePlan({
    startUrl: 'https://example.com',
    steps: [
      { action: 'goto', url: 'https://example.com' },
      { action: 'assertText', selector: 'body', contains: 'Example Domain' }
    ]
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('blocks private hosts unless local access is allowed', () => {
  const blocked = validatePlan({
    startUrl: 'http://127.0.0.1:3000',
    steps: [{ action: 'goto', url: 'http://127.0.0.1:3000' }]
  });
  assert.equal(blocked.ok, false);

  const allowed = validatePlan({
    startUrl: 'http://127.0.0.1:3000',
    steps: [{ action: 'goto', url: 'http://127.0.0.1:3000' }]
  }, { allowLocal: true });
  assert.equal(allowed.ok, true);
});

test('detects risky action wording', () => {
  assert.equal(hasRiskyTerm('button:has-text("Delete account")'), true);
  assert.equal(hasRiskyTerm('Open documentation'), false);
});

test('blocks risky selectors by default', () => {
  const result = validatePlan({
    steps: [
      { action: 'click', selector: 'button:has-text("Delete account")' }
    ]
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /high-risk/);
});

test('detects secret-like fill fields', () => {
  assert.equal(looksSecretLike('input[name=password]', 'hunter2'), true);
  assert.equal(looksSecretLike('input[name=query]', 'public search'), false);
});

test('limits plan length', () => {
  const result = validatePlan({
    steps: Array.from({ length: 4 }, () => ({ action: 'wait', ms: 1 }))
  }, { maxSteps: 3 });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /exceeds/);
});

test('identifies private hosts', () => {
  assert.equal(isPrivateHost('localhost'), true);
  assert.equal(isPrivateHost('192.168.1.1'), true);
  assert.equal(isPrivateHost('example.com'), false);
});
