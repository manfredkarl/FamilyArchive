import { Before, After, BeforeStep, AfterStep, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { CustomWorld } from './world';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

const SCREENSHOT_BASE_DIR = path.resolve(process.cwd(), 'docs', 'screenshots');

let apiProcess: ChildProcess | null = null;
let webProcess: ChildProcess | null = null;

async function isServerRunning(url: string): Promise<boolean> {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(url: string, timeout: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await isServerRunning(url)) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start within ${timeout}ms`);
}

BeforeAll(async function () {
  fs.mkdirSync(SCREENSHOT_BASE_DIR, { recursive: true });

  // Start API server if not already running
  if (!(await isServerRunning('http://localhost:5001/health'))) {
    apiProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.resolve(process.cwd(), 'src/api'),
      stdio: 'pipe',
      detached: true,
      shell: true,
    });
    await waitForServer('http://localhost:5001/health', 30000);
  }

  // Start web server if not already running
  if (!(await isServerRunning('http://localhost:3000'))) {
    webProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.resolve(process.cwd(), 'src/web'),
      stdio: 'pipe',
      detached: true,
      shell: true,
      env: { ...process.env, NEXT_PUBLIC_API_URL: 'http://localhost:5001' },
    });
    await waitForServer('http://localhost:3000', 60000);
  }
});

Before(async function (this: CustomWorld, { pickle, gherkinDocument }) {
  // Reset user store for test isolation
  try {
    await fetch('http://localhost:5001/api/test/reset', { method: 'POST' });
  } catch { /* server may not be ready yet */ }

  this.featureName = gherkinDocument?.feature?.name || 'unknown-feature';
  this.scenarioName = pickle.name || 'unknown-scenario';
  this.stepIndex = 0;
  await this.openBrowser();
});

AfterStep(async function (this: CustomWorld, { pickleStep, result }) {
  this.stepIndex++;
  const stepText = pickleStep?.text || `step-${this.stepIndex}`;
  await this.takeStepScreenshot(stepText);
});

After(async function (this: CustomWorld, { pickle, result }) {
  // Capture final state screenshot (especially useful on failures)
  if (this.page) {
    const status = result?.status === 'PASSED' ? 'final' : 'failure';
    const dir = this.screenshotDir;
    fs.mkdirSync(dir, { recursive: true });
    try {
      await this.page.screenshot({
        path: path.join(dir, `999-${status}.png`),
        fullPage: true,
      });
    } catch {
      // Browser may already be closed
    }
  }
  await this.closeBrowser();
});

AfterAll(async function () {
  if (apiProcess && apiProcess.pid) {
    try { process.kill(-apiProcess.pid, 'SIGTERM'); } catch { /* already stopped */ }
    apiProcess = null;
  }
  if (webProcess && webProcess.pid) {
    try { process.kill(-webProcess.pid, 'SIGTERM'); } catch { /* already stopped */ }
    webProcess = null;
  }
});
