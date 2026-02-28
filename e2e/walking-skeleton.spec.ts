import { test, expect } from '@playwright/test';

test.describe('Walking Skeleton — OmasApp', () => {
  // AC 6: Frontend loads with NavBar
  test('page loads and shows NavBar with "Omas Geschichten 💛"', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();
    await expect(nav.getByText('Omas Geschichten 💛')).toBeVisible();
  });

  // AC 7: Start conversation shows welcome message
  test('"Gespräch starten" creates session and shows welcome message', async ({ page }) => {
    await page.goto('/');
    const startButton = page.getByRole('button', { name: /Gespräch starten/i });
    await expect(startButton).toBeVisible();
    await startButton.click();
    // Wait for welcome message to appear
    await expect(page.locator('[data-testid="message-list"]')).toBeVisible();
    const messages = page.locator('[data-testid="message-assistant"]');
    await expect(messages.first()).toBeVisible({ timeout: 5000 });
  });

  // AC 8: Send message shows echo response
  test('typing a message shows user message and echo response', async ({ page }) => {
    await page.goto('/');
    // Start a session first
    await page.getByRole('button', { name: /Gespräch starten/i }).click();
    await expect(page.locator('[data-testid="message-assistant"]').first()).toBeVisible({ timeout: 5000 });

    // Type and send a message
    const input = page.getByPlaceholderText(/Nachricht/i);
    await input.fill('Hallo Oma');
    await page.getByRole('button', { name: /Senden/i }).click();

    // Verify user message appears
    await expect(page.locator('[data-testid="message-user"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="message-user"]').first()).toContainText('Hallo Oma');

    // Verify echo response
    const assistantMessages = page.locator('[data-testid="message-assistant"]');
    await expect(assistantMessages.nth(1)).toContainText('Echo: Hallo Oma', { timeout: 5000 });
  });

  // AC 9: Nav links exist
  test('NavBar contains links to /history, /ask, /timeline', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: /Gespräche/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Fragen/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Zeitstrahl/i })).toBeVisible();

    // Check href attributes
    await expect(nav.getByRole('link', { name: /Gespräche/i })).toHaveAttribute('href', '/history');
    await expect(nav.getByRole('link', { name: /Fragen/i })).toHaveAttribute('href', '/ask');
    await expect(nav.getByRole('link', { name: /Zeitstrahl/i })).toHaveAttribute('href', '/timeline');
  });

  // AC 9: Placeholder pages
  test('/history shows placeholder page', async ({ page }) => {
    await page.goto('/history');
    await expect(page.getByText('Kommt bald')).toBeVisible();
  });

  test('/ask shows placeholder page', async ({ page }) => {
    await page.goto('/ask');
    await expect(page.getByText('Kommt bald')).toBeVisible();
  });

  test('/timeline shows placeholder page', async ({ page }) => {
    await page.goto('/timeline');
    await expect(page.getByText('Kommt bald')).toBeVisible();
  });

  // AC 11: Accessibility basics
  test('HTML has lang="de" and body font >= 18px', async ({ page }) => {
    await page.goto('/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('de');

    const fontSize = await page.evaluate(() => {
      const body = document.querySelector('body');
      return body ? parseFloat(getComputedStyle(body).fontSize) : 0;
    });
    expect(fontSize).toBeGreaterThanOrEqual(18);
  });
});
