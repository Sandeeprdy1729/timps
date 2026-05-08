import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';

describe('E2E Tests - Authentication Flow', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should login successfully', async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('**/dashboard');
    expect(page.url()).toContain('dashboard');
  });

  it('should show error on invalid credentials', async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/login');
    await page.fill('[data-testid=email]', 'invalid@example.com');
    await page.fill('[data-testid=password]', 'wrong');
    await page.click('[data-testid=login-button]');
    await page.waitForSelector('[data-testid=error-message]');
    const error = await page.textContent('[data-testid=error-message]');
    expect(error).toContain('Invalid');
  });
});

describe('E2E Tests - Dashboard', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should display integrations', async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForSelector('[data-testid=integrations-list]');
    const integrations = await page.$$('[data-testid=integration-card]');
    expect(integrations.length).toBeGreaterThan(0);
  });

  it('should search integrations', async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/dashboard');
    await page.fill('[data-testid=search]', 'github');
    await page.waitForSelector('[data-testid=integration-card]');
    const count = await page.$$eval('[data-testid=integration-card]', els => els.length);
    expect(count).toBe(1);
  });
});

describe('E2E Tests - Memory Panel', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should display working memory', async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/memory');
    await page.waitForSelector('[data-testid=working-memory]');
    const items = await page.$$('[data-testid=memory-item]');
    expect(items).toBeDefined();
  });

  it('should search memories', async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/memory');
    await page.fill('[data-testid=search-input]', 'project');
    await page.click('[data-testid=search-button]');
    await page.waitForSelector('[data-testid=search-results]');
    const results = await page.$$('[data-testid=result-item]');
    expect(results).toBeDefined();
  });
});

describe('E2E Tests - Settings', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should update profile', async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/settings/profile');
    await page.fill('[data-testid=name]', 'Test User');
    await page.click('[data-testid=save-button]');
    await page.waitForSelector('[data-testid=success-message]');
  });

  it('should change theme', async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/settings');
    await page.click('[data-testid=theme-toggle]');
    const htmlClass = await page.$eval('html', el => el.className);
    expect(htmlClass).toContain('dark');
  });
});

describe('E2E Tests - Integrations', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should connect GitHub', async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/integrations');
    await page.click('[data-testid=connect-github]');
    await page.waitForURL('**/github/auth');
    await page.fill('[data-testid=token-input]', 'test-token');
    await page.click('[data-testid=submit-button]');
    await page.waitForSelector('[data-testid=connected-badge]');
  });

  it('should disconnect integration', async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/integrations');
    await page.click('[data-testid=disconnect-slack]');
    await page.click('[data-testid=confirm-disconnect]');
    await page.waitForSelector('[data-testid=disconnected-badge]');
  });
});

describe('E2E Tests - Performance', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should load within 2 seconds', async () => {
    page = await browser.newPage();
    const start = Date.now();
    await page.goto('http://localhost:3000/dashboard');
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(2000);
  });

  it('should have no console errors', async () => {
    const errors: string[] = [];
    page = await browser.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForTimeout(1000);
    expect(errors.length).toBe(0);
  });
});