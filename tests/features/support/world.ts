import { World, setWorldConstructor } from '@cucumber/cucumber';
import { Browser, BrowserContext, Page, chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_BASE_DIR = path.resolve(process.cwd(), 'docs', 'screenshots');

export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;

  featureName = '';
  scenarioName = '';
  stepIndex = 0;

  response: { status: number; body: any; headers: Headers } | null = null;
  cookies: string[] = [];
  apiBaseUrl = 'http://localhost:5001';
  webBaseUrl = 'http://localhost:3000';
  storedPasswords: Record<string, string> = {};
  tamperedJwt: string | null = null;

  async apiRequest(method: string, path: string, body?: object): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.cookies.length) headers['Cookie'] = this.cookies.join('; ');
    const options: RequestInit = { method, headers };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${this.apiBaseUrl}${path}`, options);
    const setCookies = res.headers.getSetCookie?.() || [];
    if (setCookies.length) this.cookies = setCookies;
    const responseBody = await res.json().catch(() => null);
    this.response = { status: res.status, body: responseBody, headers: res.headers };
  }

  async openBrowser() {
    this.browser = await chromium.launch();
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    this.page = await this.context.newPage();
  }

  async closeBrowser() {
    await this.context?.close();
    await this.browser?.close();
  }

  get screenshotDir(): string {
    const featureSlug = this.featureName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const scenarioSlug = this.scenarioName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return path.join(SCREENSHOT_BASE_DIR, featureSlug, scenarioSlug);
  }

  async takeStepScreenshot(stepText: string): Promise<string | undefined> {
    if (!this.page) return undefined;
    const dir = this.screenshotDir;
    fs.mkdirSync(dir, { recursive: true });

    const stepSlug = stepText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
    const filename = `${String(this.stepIndex).padStart(3, '0')}-${stepSlug}.png`;
    const filepath = path.join(dir, filename);

    try {
      await this.page.screenshot({ path: filepath, fullPage: false });
      return filepath;
    } catch {
      // Page may not be navigated yet — skip silently
      return undefined;
    }
  }
}

setWorldConstructor(CustomWorld);
