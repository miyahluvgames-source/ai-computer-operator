const ALLOWED_ACTIONS = new Set([
  'goto',
  'click',
  'fill',
  'press',
  'waitFor',
  'wait',
  'screenshot',
  'extractText',
  'assertText',
  'selectOption',
  'check',
  'uncheck',
  'hover',
  'setViewport'
]);

const RISKY_TERMS = [
  'delete',
  'remove',
  'destroy',
  'withdraw',
  'transfer',
  'send',
  'purchase',
  'buy',
  'sell',
  'trade',
  'swap',
  'stake',
  'unstake',
  'submit',
  'confirm',
  'payment',
  'checkout',
  'close account',
  'deactivate'
];

const SECRET_TERMS = [
  'password',
  'passcode',
  'secret',
  'token',
  'api key',
  'apikey',
  'private key',
  'seed phrase',
  'mnemonic',
  'wallet',
  'card number',
  'cvv',
  'ssn'
];

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/i
];

export function validatePlan(plan, options = {}) {
  const errors = [];
  const warnings = [];
  const maxSteps = Number(options.maxSteps || 30);

  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return { ok: false, errors: ['Plan must be a JSON object.'], warnings };
  }

  if (!Array.isArray(plan.steps)) {
    errors.push('Plan must include a steps array.');
  } else if (plan.steps.length > maxSteps) {
    errors.push(`Plan has ${plan.steps.length} steps, which exceeds maxSteps ${maxSteps}.`);
  }

  if (plan.startUrl) {
    validateUrl(plan.startUrl, options, errors, 'startUrl');
  }

  for (const [index, step] of (plan.steps || []).entries()) {
    validateStep(step, index, options, errors, warnings);
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateUrl(rawUrl, options, errors, fieldName) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    errors.push(`${fieldName} is not a valid URL: ${rawUrl}`);
    return;
  }

  if (!['http:', 'https:', 'about:'].includes(parsed.protocol)) {
    errors.push(`${fieldName} uses unsupported protocol: ${parsed.protocol}`);
  }

  if (!options.allowLocal && isPrivateHost(parsed.hostname)) {
    errors.push(`${fieldName} points to a local or private host. Use --allow-local only when this is intentional.`);
  }
}

export function isPrivateHost(hostname) {
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

function validateStep(step, index, options, errors, warnings) {
  const label = `steps[${index}]`;

  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  if (!ALLOWED_ACTIONS.has(step.action)) {
    errors.push(`${label}.action is unsupported: ${step.action}`);
    return;
  }

  if (step.action === 'goto') {
    if (!step.url) errors.push(`${label}.url is required for goto.`);
    if (step.url) validateUrl(step.url, options, errors, `${label}.url`);
  }

  if (['click', 'fill', 'waitFor', 'extractText', 'assertText', 'selectOption', 'check', 'uncheck', 'hover'].includes(step.action)) {
    if (!step.selector) errors.push(`${label}.selector is required for ${step.action}.`);
  }

  if (step.action === 'fill') {
    if (typeof step.value !== 'string') {
      errors.push(`${label}.value must be a string for fill.`);
    }
    const secretSurface = `${step.selector || ''} ${step.label || ''} ${step.name || ''}`;
    if (!options.allowSecretFill && looksSecretLike(secretSurface, step.value || '')) {
      errors.push(`${label} appears to fill a sensitive field. Use a safer workflow instead of passing secrets into an automation plan.`);
    }
  }

  if (step.action === 'assertText' && typeof step.contains !== 'string') {
    errors.push(`${label}.contains must be a string for assertText.`);
  }

  if (step.action === 'press' && typeof step.key !== 'string') {
    errors.push(`${label}.key must be a string for press.`);
  }

  if (step.action === 'wait' && step.ms != null && !Number.isFinite(Number(step.ms))) {
    errors.push(`${label}.ms must be a number for wait.`);
  }

  const riskSurface = `${step.selector || ''} ${step.label || ''} ${step.text || ''} ${step.action || ''}`;
  if (!options.allowRiskyActions && hasRiskyTerm(riskSurface)) {
    errors.push(`${label} contains a high-risk action term. Re-check the plan or run with --allow-risky-actions only after explicit approval.`);
  } else if (hasRiskyTerm(riskSurface)) {
    warnings.push(`${label} contains high-risk wording and was allowed by override.`);
  }
}

export function hasRiskyTerm(value) {
  const lower = String(value || '').toLowerCase();
  return RISKY_TERMS.some((term) => lower.includes(term));
}

export function looksSecretLike(surface, value) {
  const lowerSurface = String(surface || '').toLowerCase();
  const lowerValue = String(value || '').toLowerCase();
  if (SECRET_TERMS.some((term) => lowerSurface.includes(term))) return true;
  if (/sk-[a-z0-9_-]{20,}/i.test(value)) return true;
  if (/gh[pousr]_[a-z0-9_]{20,}/i.test(value)) return true;
  if (/-----begin [a-z ]*private key-----/i.test(value)) return true;
  if (lowerValue.split(/\s+/).length >= 12 && lowerSurface.includes('seed')) return true;
  return false;
}
