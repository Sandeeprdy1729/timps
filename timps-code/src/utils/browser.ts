import puppeteer from 'puppeteer';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;

let browser: Browser | null = null;
let page: Page | null = null;

export async function getBrowserPage(): Promise<Page> {
  if (!browser) {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
  }
  return page!;
}

export async function shutdownBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}
