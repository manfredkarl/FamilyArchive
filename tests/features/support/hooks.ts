import { Before, After, BeforeStep, AfterStep, BeforeAll } from '@cucumber/cucumber';
import { CustomWorld } from './world';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_BASE_DIR = path.resolve(process.cwd(), 'docs', 'screenshots');

BeforeAll(async function () {
  fs.mkdirSync(SCREENSHOT_BASE_DIR, { recursive: true });
});

Before(async function (this: CustomWorld, { pickle, gherkinDocument }) {
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
