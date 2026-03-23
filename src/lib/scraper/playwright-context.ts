import { chromium, type Page } from "playwright";

/** Runs work with a headless Chromium page; always closes the browser. */
export async function withChromiumPage<T>(run: (page: Page) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    return await run(page);
  } finally {
    await browser.close();
  }
}
