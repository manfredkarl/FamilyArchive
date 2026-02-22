import { Before, After, AfterStep, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { CustomWorld } from './world';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

setDefaultTimeout(30_000);

const SCREENSHOT_BASE_DIR = path.resolve(process.cwd(), 'docs', 'screenshots');
const GENERATE_SCREENSHOTS = process.env.GENERATE_SCREENSHOTS === 'true';
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:5001';

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
  if (!(await isServerRunning(`${API_URL}/health`))) {
    apiProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.resolve(process.cwd(), 'src/api'),
      stdio: 'pipe',
      detached: true,
      shell: true,
    });
    await waitForServer(`${API_URL}/health`, 30000);
  }

  // Start web server if generating screenshots and not already running
  if (GENERATE_SCREENSHOTS && !(await isServerRunning(WEB_URL))) {
    webProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.resolve(process.cwd(), 'src/web'),
      stdio: 'pipe',
      detached: true,
      shell: true,
      env: { ...process.env, PORT: '3000' },
    });
    await waitForServer(WEB_URL, 60000);
  }
});

Before(async function (this: CustomWorld, { pickle, gherkinDocument }) {
  // Reset stores for test isolation
  try {
    await fetch(`${API_URL}/api/test/reset`, { method: 'POST' });
  } catch { /* server may not be ready yet */ }

  this.featureName = gherkinDocument?.feature?.name || 'unknown-feature';
  this.scenarioName = pickle.name || 'unknown-scenario';
  this.stepIndex = 0;

  // Open browser for @ui tagged scenarios, OR for all scenarios when generating screenshots
  const tags = pickle.tags?.map(t => t.name) || [];
  if (tags.includes('@ui') || GENERATE_SCREENSHOTS) {
    await this.openBrowser();
    // Navigate to the actual app so screenshots aren't blank
    if (this.page) {
      try {
        await this.page.goto(WEB_URL, { waitUntil: 'networkidle', timeout: 15000 });
      } catch {
        // App may not be fully loaded yet — still take screenshots
        try { await this.page.goto(WEB_URL, { waitUntil: 'domcontentloaded', timeout: 10000 }); } catch { /* best effort */ }
      }
    }
  }
});

AfterStep(async function (this: CustomWorld, { pickleStep, result }) {
  this.stepIndex++;
  if (this.page) {
    const stepText = pickleStep?.text || `step-${this.stepIndex}`;
    // Extract Gherkin keyword from the step text (Given/When/Then/And)
    const keyword = (pickleStep as any)?.keyword?.trim() ||
      (stepText.match(/^(Given|When|Then|And|But)\b/)?.[1] ?? 'Step');
    const status = result?.status?.toString() || 'PASSED';
    // Inject visual overlay showing current step context
    await this.injectStepOverlay(keyword, stepText, status);
    await this.takeStepScreenshot(stepText);
  }
});

After(async function (this: CustomWorld, { result }) {
  if (this.page) {
    // Only mark as failure for actually FAILED tests — not pending or skipped
    let status: string;
    switch (result?.status) {
      case 'PASSED':
        status = 'final';
        break;
      case 'FAILED':
        status = 'failure';
        break;
      case 'PENDING':
      case 'SKIPPED':
      case 'UNDEFINED':
        status = 'skipped';
        break;
      default:
        status = 'final';
    }
    const dir = this.screenshotDir;
    fs.mkdirSync(dir, { recursive: true });
    try {
      await this.page.screenshot({
        path: path.join(dir, `999-${status}.png`),
        fullPage: true,
      });
    } catch { /* Browser may already be closed */ }
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
