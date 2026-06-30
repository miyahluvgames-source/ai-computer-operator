import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { ensureDir, writeJson } from './report.js';
import { validatePlan } from './safety.js';
import { launchCdpChrome } from './chrome-cdp.js';

export async function runPlanWithBrowserHarness(plan, options = {}) {
  const outDir = path.resolve(options.outDir || 'artifacts');
  ensureDir(outDir);

  const validation = validatePlan(plan, options);
  if (!validation.ok) {
    const error = new Error(`Plan validation failed:\n- ${validation.errors.join('\n- ')}`);
    error.validation = validation;
    throw error;
  }

  const planPath = path.join(outDir, '.browser-harness-plan.json');
  const reportPath = path.join(outDir, 'session-report.json');
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

  let launchedChrome = null;
  let cdpEndpoint = options.cdpEndpoint || process.env.BU_CDP_URL || null;
  if (!cdpEndpoint && !process.env.BU_CDP_WS) {
    launchedChrome = await launchCdpChrome({
      cdpPort: options.cdpPort,
      headed: options.headed,
      userDataDir: path.join(outDir, '.chrome-profile')
    });
    cdpEndpoint = launchedChrome.endpoint;
  }

  const runId = makeBrowserHarnessRunId();
  const browserHarnessHome = path.resolve(options.browserHarnessHome || path.join(outDir, '.browser-harness'));
  const browserHarnessRunHome = path.join(browserHarnessHome, runId);
  const env = {
    ...process.env,
    PYTHONUTF8: '1',
    BU_CDP_URL: cdpEndpoint || process.env.BU_CDP_URL || '',
    BU_NAME: runId,
    BH_HOME: browserHarnessRunHome,
    BROWSER_HARNESS_HOME: browserHarnessRunHome,
    BH_CONFIG_DIR: path.join(browserHarnessRunHome, 'config'),
    BH_RUNTIME_DIR: path.join(browserHarnessRunHome, 'runtime'),
    BH_TMP_DIR: path.join(browserHarnessRunHome, 'tmp'),
    BH_AGENT_WORKSPACE: path.join(browserHarnessRunHome, 'workspace'),
    PATH: addUserLocalBinToPath(process.env.PATH || '')
  };

  const script = buildBrowserHarnessScript(planPath, reportPath, outDir, {
    timeout: Number(options.timeout || 30000),
    warnings: validation.warnings
  });

  try {
    const result = await runBrowserHarness(script, env);
    if (result.code !== 0) {
      const error = new Error(`browser-harness failed with exit code ${result.code}:\n${result.stderr.trim() || result.stdout.trim()}`);
      if (fs.existsSync(reportPath)) error.report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      throw error;
    }
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('browser-harness is not installed or not on PATH. Install it with: uv tool install --python 3.12 --upgrade --force browser-harness');
    }
    throw error;
  } finally {
    await stopBrowserHarnessDaemon(env);
    await launchedChrome?.close();
  }
}

export async function isBrowserHarnessAvailable() {
  const env = { ...process.env, PATH: addUserLocalBinToPath(process.env.PATH || '') };
  try {
    const result = await runProcess('browser-harness', ['--version'], { env });
    return result.code === 0;
  } catch {
    return false;
  }
}

function runBrowserHarness(script, env) {
  return runProcess('browser-harness', [], { env, input: script });
}

async function stopBrowserHarnessDaemon(env) {
  try {
    await runProcess('browser-harness', ['--reload'], { env });
  } catch {
    // Best-effort cleanup. The launched Chromium process is still closed by the caller.
  }
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    if (options.input) child.stdin.end(options.input);
    else child.stdin.end();
  });
}

function addUserLocalBinToPath(rawPath) {
  const userProfile = process.env.USERPROFILE;
  if (!userProfile) return rawPath;
  const userBin = path.join(userProfile, '.local', 'bin');
  return rawPath.includes(userBin) ? rawPath : `${userBin}${path.delimiter}${rawPath}`;
}

function makeBrowserHarnessRunId() {
  return `aco-${process.pid}-${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

function buildBrowserHarnessScript(planPath, reportPath, outDir, options) {
  return `
import json
import os
import hashlib
import time
import traceback

plan_path = ${JSON.stringify(planPath)}
report_path = ${JSON.stringify(reportPath)}
out_dir = ${JSON.stringify(outDir)}
default_timeout = ${JSON.stringify(options.timeout)}
warnings = ${JSON.stringify(options.warnings)}

with open(plan_path, "r", encoding="utf-8") as f:
    plan = json.load(f)

os.makedirs(out_dir, exist_ok=True)
report = {
    "name": plan.get("name") or "AI Computer Operator run",
    "engine": "browser-harness",
    "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "finishedAt": None,
    "status": "running",
    "finalUrl": None,
    "warnings": warnings,
    "steps": [],
    "artifacts": []
}

def write_report():
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def safe_path(name, fallback):
    base = name or fallback
    clean = "".join(c if c.isalnum() or c in "._-" else "-" for c in base).strip(".-")
    return os.path.join(out_dir, clean or fallback)

def css_text(selector):
    return js("""
    (() => {
      const e = document.querySelector(%s);
      if (!e) throw new Error('selector not found: %s');
      return e.innerText || e.textContent || '';
    })()
    """ % (json.dumps(selector), selector.replace("'", "\\\\'")))

def css_click(selector):
    return js("""
    (() => {
      const e = document.querySelector(%s);
      if (!e) throw new Error('selector not found: %s');
      e.scrollIntoView({block: 'center', inline: 'center'});
      const r = e.getBoundingClientRect();
      e.click();
      return {x: r.left + r.width / 2, y: r.top + r.height / 2};
    })()
    """ % (json.dumps(selector), selector.replace("'", "\\\\'")))

def css_hover(selector):
    point = js("""
    (() => {
      const e = document.querySelector(%s);
      if (!e) throw new Error('selector not found: %s');
      e.scrollIntoView({block: 'center', inline: 'center'});
      const r = e.getBoundingClientRect();
      return {x: r.left + r.width / 2, y: r.top + r.height / 2};
    })()
    """ % (json.dumps(selector), selector.replace("'", "\\\\'")))
    cdp("Input.dispatchMouseEvent", type="mouseMoved", x=point["x"], y=point["y"])
    return point

def visual_hash(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()

def observe_stable(step, index, timeout_sec):
    if step.get("selector"):
        found = wait_for_element(step["selector"], timeout=timeout_sec, visible=(step.get("state") or "visible") == "visible")
        if not found:
            raise RuntimeError("selector not found before timeout: %s" % step["selector"])

    interval_sec = float(step.get("intervalMs") or 250) / 1000.0
    stable_sec = float(step.get("stableMs") or 1000) / 1000.0
    deadline = time.time() + timeout_sec
    last_hash = None
    stable_since = None
    samples = 0
    temp_artifact = safe_path(".observe-%s.png" % index, ".observe-%s.png" % index)
    final_artifact = safe_path(step.get("name"), "stable-%s.png" % index)

    while time.time() <= deadline:
        capture_screenshot(temp_artifact, full=step.get("fullPage", True) is not False)
        current_hash = visual_hash(temp_artifact)
        samples += 1
        if current_hash == last_hash:
            if stable_since is None:
                stable_since = time.time()
            if time.time() - stable_since >= stable_sec:
                os.replace(temp_artifact, final_artifact)
                return {
                    "selector": step.get("selector"),
                    "artifact": final_artifact,
                    "samples": samples,
                    "stableMs": int(stable_sec * 1000),
                    "intervalMs": int(interval_sec * 1000),
                    "hash": current_hash[:16]
                }
        else:
            last_hash = current_hash
            stable_since = time.time()
        wait(interval_sec)

    if os.path.exists(temp_artifact):
        os.replace(temp_artifact, final_artifact)
    raise RuntimeError("Page did not reach a stable visual state within %sms. Last screenshot: %s" % (int(timeout_sec * 1000), final_artifact))

def set_viewport(viewport):
    width = int((viewport or {}).get("width") or 1280)
    height = int((viewport or {}).get("height") or 720)
    cdp("Emulation.setDeviceMetricsOverride", width=width, height=height, deviceScaleFactor=1, mobile=False)
    return {"width": width, "height": height}

def run_step(step, index):
    base = {
        "index": index,
        "action": step.get("action"),
        "startedAt": now_iso(),
        "finishedAt": None,
        "status": "passed"
    }
    timeout_sec = float(step.get("timeout") or default_timeout) / 1000.0
    action = step.get("action")

    if action == "goto":
        goto_url(step["url"])
        wait_for_load(timeout_sec)
        base.update({"url": page_info().get("url"), "httpStatus": None})
    elif action == "click":
        base.update({"selector": step["selector"], "point": css_click(step["selector"])})
    elif action == "fill":
        fill_input(step["selector"], step.get("value") or "", timeout=timeout_sec)
        base.update({"selector": step["selector"], "filled": True})
    elif action == "press":
        press_key(step["key"])
        base.update({"key": step["key"]})
    elif action == "waitFor":
        found = wait_for_element(step["selector"], timeout=timeout_sec, visible=(step.get("state") or "visible") == "visible")
        if not found:
            raise RuntimeError("selector not found before timeout: %s" % step["selector"])
        base.update({"selector": step["selector"], "state": step.get("state") or "visible"})
    elif action == "wait":
        wait(float(step.get("ms") or 1000) / 1000.0)
        base.update({"ms": int(step.get("ms") or 1000)})
    elif action == "screenshot":
        artifact = safe_path(step.get("name"), "screenshot-%s.png" % index)
        capture_screenshot(artifact, full=bool(step.get("fullPage")))
        base.update({"artifact": artifact})
    elif action == "extractText":
        text = css_text(step["selector"])
        artifact = safe_path(step.get("name"), "text-%s.txt" % index)
        with open(artifact, "w", encoding="utf-8") as f:
            f.write(text + "\\n")
        base.update({"selector": step["selector"], "artifact": artifact, "chars": len(text)})
    elif action == "assertText":
        text = css_text(step["selector"])
        if step["contains"] not in text:
            raise RuntimeError("Expected text not found in %s: %s" % (step["selector"], step["contains"]))
        base.update({"selector": step["selector"], "contains": step["contains"]})
    elif action == "selectOption":
        changed = js("""
        (() => {
          const e = document.querySelector(%s);
          if (!e) throw new Error('selector not found: %s');
          e.value = %s;
          e.dispatchEvent(new Event('input', {bubbles: true}));
          e.dispatchEvent(new Event('change', {bubbles: true}));
          return e.value;
        })()
        """ % (json.dumps(step["selector"]), step["selector"].replace("'", "\\\\'"), json.dumps(step["value"])))
        base.update({"selector": step["selector"], "value": changed})
    elif action in ("check", "uncheck"):
        checked = action == "check"
        js("""
        (() => {
          const e = document.querySelector(%s);
          if (!e) throw new Error('selector not found: %s');
          e.checked = %s;
          e.dispatchEvent(new Event('input', {bubbles: true}));
          e.dispatchEvent(new Event('change', {bubbles: true}));
          return e.checked;
        })()
        """ % (json.dumps(step["selector"]), step["selector"].replace("'", "\\\\'"), "true" if checked else "false"))
        base.update({"selector": step["selector"]})
    elif action == "hover":
        base.update({"selector": step["selector"], "point": css_hover(step["selector"])})
    elif action == "setViewport":
        base.update({"viewport": set_viewport(step.get("viewport") or step)})
    elif action == "observeStable":
        base.update(observe_stable(step, index, timeout_sec))
    else:
        raise RuntimeError("Unsupported action: %s" % action)

    base["finishedAt"] = now_iso()
    return base

try:
    set_viewport(plan.get("viewport") or {})
    if plan.get("startUrl"):
        new_tab(plan["startUrl"])
        wait_for_load(float(default_timeout) / 1000.0)

    for index, step in enumerate(plan.get("steps") or []):
        result = run_step(step, index)
        report["steps"].append(result)
        if result.get("artifact"):
            report["artifacts"].append(result["artifact"])

    report["status"] = "passed"
    report["finalUrl"] = page_info().get("url")
except Exception as exc:
    report["status"] = "failed"
    report["error"] = {"message": str(exc), "traceback": traceback.format_exc(limit=5)}
    try:
        report["finalUrl"] = page_info().get("url")
    except Exception:
        report["finalUrl"] = None
    write_report()
    raise
finally:
    report["finishedAt"] = now_iso()
    write_report()
`;
}
