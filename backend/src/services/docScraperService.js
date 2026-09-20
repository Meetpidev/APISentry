// Fetches a docs page as rendered text. Two strategies:
//   - headless: launches Playwright/Chromium, waits for the page to render
//     (needed for React/Vue/Next.js docs sites that inject content via JS —
//     a plain fetch only sees the initial empty shell for these).
//   - plain: a fast raw-HTML fetch + regex strip, used when
//     DOCS_USE_HEADLESS_BROWSER=false or when the headless browser fails to
//     launch (e.g. Playwright's browser binary isn't installed).
import { createHash } from "crypto";

async function fetchPlain(url) {
  const res = await fetch(url, { headers: { "User-Agent": "APISentry-DocMonitor/1.0" } });
  if (!res.ok) {
    throw Object.assign(new Error(`Could not fetch docs page (${res.status}): ${url}`), { status: 502 });
  }
  const html = await res.text();
  return htmlToText(html);
}

async function fetchHeadless(url) {
  // Dynamic import so a missing/failed Playwright install doesn't crash
  // the whole app at boot — it only matters when this path is actually used.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: "APISentry-DocMonitor/1.0" });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    // Give client-side-rendered frameworks a moment past "networkidle" for
    // any deferred hydration/content injection to settle.
    await page.waitForTimeout(1000);
    const html = await page.content();
    return htmlToText(html);
  } finally {
    await browser.close();
  }
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function fetchDocsText(url) {
  const useHeadless = process.env.DOCS_USE_HEADLESS_BROWSER !== "false";

  let text;
  let fetchedVia;

  if (useHeadless) {
    try {
      text = await fetchHeadless(url);
      fetchedVia = "headless_browser";
    } catch (err) {
      console.error(`Headless browser fetch failed for ${url}, falling back to plain fetch:`, err.message);
      text = await fetchPlain(url);
      fetchedVia = "fetch";
    }
  } else {
    text = await fetchPlain(url);
    fetchedVia = "fetch";
  }

  const hash = createHash("sha256").update(text).digest("hex");
  return { text, hash, fetchedVia };
}