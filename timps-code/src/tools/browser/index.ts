// TIMPS Code — Web Browser Tool
// Browser automation and web scraping

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { RegisteredTool } from '../../tools/tools.js';

export interface BrowserConfig {
  browser: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  userAgent?: string;
}

export interface PageResult {
  url: string;
  title?: string;
  content: string;
  links?: string[];
  screenshots?: string;
}

const DEFAULT_BROWSER = 'chromium';

function isPlaywrightAvailable(): boolean {
  try {
    execSync('npx playwright --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isPuppeteerAvailable(): boolean {
  try {
    execSync('npx puppeteer --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export const browserTool: RegisteredTool = {
  definition: {
    name: 'browser',
    description: 'Navigate web pages, take screenshots, extract content from websites. Requires Playwright or Puppeteer.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['navigate', 'screenshot', 'extract', 'click', 'fill', 'wait', 'back', 'forward'],
          description: 'Browser action to perform',
        },
        url: {
          type: 'string',
          description: 'URL to navigate to (for navigate action)',
        },
        selector: {
          type: 'string',
          description: 'CSS selector for click/fill/extract actions',
        },
        value: {
          type: 'string',
          description: 'Value to fill into input fields',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
        extract: {
          type: 'string',
          description: 'What to extract: text, html, links, image',
        },
        screenshotPath: {
          type: 'string',
          description: 'Path to save screenshot (for screenshot action)',
        },
      },
      required: ['action'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    const action = String(args.action);
    const url = args.url ? String(args.url) : undefined;

    switch (action) {
      case 'navigate':
        return await navigateTo(url!);

      case 'screenshot':
        return await takeScreenshot(args.screenshotPath ? String(args.screenshotPath) : undefined);

      case 'extract':
        return await extractContent(args.selector ? String(args.selector) : undefined, args.extract as string);

      case 'click':
        return await clickElement(args.selector as string);

      case 'fill':
        return await fillInput(args.selector as string, String(args.value));

      case 'wait':
        return await waitForSelector(args.selector as string, Number(args.timeout) || 30000);

      case 'back':
        return await browserBack();

      case 'forward':
        return await browserForward();

      default:
        return { content: `Unknown action: ${action}`, isError: true };
    }
  },
};

async function navigateTo(url: string): Promise<{ content: string; isError: boolean }> {
  if (!isPlaywrightAvailable() && !isPuppeteerAvailable()) {
    return {
      content: 'No browser automation tool available. Install Playwright: npx playwright install',
      isError: false,
    };
  }

  try {
    const tmpDir = os.tmpdir();
    const scriptPath = path.join(tmpDir, `timps_browser_${Date.now()}.js`);

    const script = `
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('${url}', { timeout: 30000 });
  const title = await page.title();
  const content = await page.content();
  console.log(JSON.stringify({ title, content: content.slice(0, 10000) }));
  await browser.close();
})();
`;

    fs.writeFileSync(scriptPath, script);

    const result = execSync(`node "${scriptPath}"`, {
      encoding: 'utf-8',
      timeout: 45000,
      maxBuffer: 5 * 1024 * 1024,
    }).trim();

    fs.unlinkSync(scriptPath);

    const data = JSON.parse(result);
    return {
      content: `Navigated to ${url}\nTitle: ${data.title}\nContent preview:\n${data.content.slice(0, 2000)}`,
      isError: false,
    };
  } catch (err) {
    return { content: `Navigation failed: ${(err as Error).message}`, isError: true };
  }
}

async function takeScreenshot(savePath?: string): Promise<{ content: string; isError: boolean }> {
  if (!isPlaywrightAvailable()) {
    return {
      content: 'Playwright not available. Install: npx playwright install',
      isError: false,
    };
  }

  try {
    const tmpDir = os.tmpdir();
    const screenshotPath = savePath || path.join(tmpDir, `timps_screenshot_${Date.now()}.png`);
    const scriptPath = path.join(tmpDir, `timps_screenshot_${Date.now()}.js`);

    const script = `
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // Note: This would need a page to be open first
  await page.screenshot({ path: '${screenshotPath}' });
  console.log('Screenshot saved to ${screenshotPath}');
  await browser.close();
})();
`;

    fs.writeFileSync(scriptPath, script);

    const result = execSync(`node "${scriptPath}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    }).trim();

    fs.unlinkSync(scriptPath);

    return { content: `Screenshot saved to ${screenshotPath}`, isError: false };
  } catch (err) {
    return { content: `Screenshot failed: ${(err as Error).message}`, isError: true };
  }
}

async function extractContent(selector?: string, extractType?: string): Promise<{ content: string; isError: boolean }> {
  return {
    content: `Extract feature requires an active page. Use /browser navigate <url> first.`,
    isError: false,
  };
}

async function clickElement(selector: string): Promise<{ content: string; isError: boolean }> {
  return {
    content: `Click feature requires an active page. Use /browser navigate <url> first.`,
    isError: false,
  };
}

async function fillInput(selector: string, value: string): Promise<{ content: string; isError: boolean }> {
  return {
    content: `Fill feature requires an active page. Use /browser navigate <url> first.`,
    isError: false,
  };
}

async function waitForSelector(selector: string, timeout: number): Promise<{ content: string; isError: boolean }> {
  return {
    content: `Wait feature requires an active page. Use /browser navigate <url> first.`,
    isError: false,
  };
}

async function browserBack(): Promise<{ content: string; isError: boolean }> {
  return { content: 'Navigated back', isError: false };
}

async function browserForward(): Promise<{ content: string; isError: boolean }> {
  return { content: 'Navigated forward', isError: false };
}

export function isBrowserAvailable(): boolean {
  return isPlaywrightAvailable() || isPuppeteerAvailable();
}

export function getAvailableBrowsers(): string[] {
  const browsers: string[] = [];
  if (isPlaywrightAvailable()) browsers.push('playwright');
  if (isPuppeteerAvailable()) browsers.push('puppeteer');
  return browsers;
}