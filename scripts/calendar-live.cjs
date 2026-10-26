// Kontrola rzeczywistego źródła: bez podstawiania API, preload ani odpowiedzi HTTP.
const { _electron, expect } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");

async function main() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: [path.resolve(__dirname, "..")], env });
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await app.evaluate(() => {
      const original = globalThis.fetch;
      globalThis.calendarRequestCount = 0;
      globalThis.fetch = (url, options) => {
        if (url.startsWith("https://www.filmweb.pl/premiere/")) globalThis.calendarRequestCount++;
        return original(url, options);
      };
    });
    const output = path.resolve(__dirname, "../output/calendar-check");
    fs.mkdirSync(output, { recursive: true });
    for (const [index, button] of ["calendar-open", "calendar-next", "calendar-previous", "calendar-open"].entries()) {
      await page.locator("#" + button).click();
      await expect.poll(() => app.evaluate(() => globalThis.calendarRequestCount)).toBe(index + 1);
      await expect(page.locator("#calendar-panel")).toHaveAttribute("aria-busy", "false", { timeout: 40000 });
      const status = await page.locator("#calendar-update").innerText();
      const titles = await page.locator(".release-copy strong").allTextContents();
      console.log(JSON.stringify({ button, range: await page.locator("#calendar-range").innerText(), status, count: titles.length, sample: titles.slice(0, 6) }));
      assert.match(status, /Sprawdzono/, "Odczyt źródła nie powiódł się");
      assert.ok(titles.length > 0, "Źródło nie zwróciło żadnych premier w testowanym okresie");
      const ids = await page.locator(".release-day li").evaluateAll(cards => cards.map(card => card.dataset.filmId));
      assert.equal(new Set(ids).size, ids.length, "Film pojawił się przy więcej niż jednej dacie");
      if (index === 0) {
        // Sprawdzamy dekodowanie rzeczywistych obrazów, a nie tylko obecność adresu URL.
        const posters = page.locator(".release-banner");
        await expect(posters).toHaveCount(titles.length);
        await posters.evaluateAll(images => images.forEach(img => { img.loading = "eager"; }));
        await expect.poll(() => posters.evaluateAll(images => images.filter(img => img.complete && img.naturalWidth > 0).length), { timeout: 30000 }).toBe(titles.length);
        console.log(JSON.stringify({ decodedPosters: await posters.count() }));
        await page.locator(".release-day").first().evaluate(element => element.scrollIntoView({ block: "start" }));
        await page.screenshot({ path: path.join(output, "desktop.png") });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Widok mobilny wychodzi poza ekran");
        await page.locator(".release-day").first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, "phone.png") });
        await page.setViewportSize({ width: 1100, height: 780 });
      }
    }
  } finally { await app.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
