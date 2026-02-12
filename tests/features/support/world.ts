import { World, setWorldConstructor } from '@cucumber/cucumber';
import { Browser, Page, chromium } from '@playwright/test';

export class CustomWorld extends World {
  browser!: Browser;
  page!: Page;

  async openBrowser() {
    this.browser = await chromium.launch();
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async closeBrowser() {
    await this.browser?.close();
  }
}

setWorldConstructor(CustomWorld);
