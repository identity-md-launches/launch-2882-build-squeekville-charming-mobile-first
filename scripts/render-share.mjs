import { readFile } from "node:fs/promises";
const { chromium } = await import(process.argv[2] ?? "playwright");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    '<!doctype html><html lang="en"><title>Squeekville share artwork</title><style>body{margin:0}svg{display:block}</style>' +
      (await readFile("src/assets/share.svg", "utf8")),
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "public/share.png" });
} finally {
  await browser.close();
}
