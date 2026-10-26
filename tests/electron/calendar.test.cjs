// Uruchamiamy prawdziwy preload i IPC. Podmieniony jest wyłącznie transport HTTP,
// dzięki czemu test wykrywa brakujące połączenie między oknem a procesem głównym.
const test = require("node:test");
const assert = require("node:assert/strict");
const { _electron, expect } = require("@playwright/test");
const path = require("node:path");
const { calendarPage } = require("../fixtures/calendar.cjs");

test("Electron calendar refreshes on every click and ignores obsolete responses", async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: [path.resolve(__dirname, "../..")], env });
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.clock.install({ time: new Date(2026, 0, 31, 12) });
    // Ustawiamy zegar przed ponownym ładowaniem, aby sprawdzić przejście z 31 stycznia.
    await page.reload();
    await app.evaluate(({ shell }) => {
      globalThis.openedSources = [];
      shell.openExternal = async url => { globalThis.openedSources.push(url); };
      const original = globalThis.fetch;
      globalThis.calendarCalls = [];
      globalThis.fetch = (url, options) => {
        if (!url.startsWith("https://www.filmweb.pl/premiere/")) return original(url, options);
        return new Promise((resolve, reject) => {
          globalThis.calendarCalls.push({ url, options, resolve, reject });
        });
      };
    });
    const calls = () => app.evaluate(() => globalThis.calendarCalls.length);
    const respond = (index, title, date) => app.evaluate((_electron, data) => {
      globalThis.calendarCalls[data.index].resolve(new Response(data.html));
    }, { index, html: calendarPage([{ title, date }]) });
    assert.equal(await page.evaluate(() => typeof window.cinema.getReleaseCalendar), "function");
    await page.locator("#calendar-open").click();
    await expect.poll(calls).toBe(1);
    await expect(page.locator("#calendar-update")).toContainText("Pobieramy");
    await expect(page.locator("#calendar-list")).not.toContainText("Brak potwierdzonych");
    await page.locator("#calendar-next").click();
    await expect.poll(calls).toBe(2);
    await expect(page.locator("#calendar-range")).toContainText("luty");
    await page.locator("#calendar-previous").click();
    await expect.poll(calls).toBe(3);
    await respond(2, "Najnowszy wynik", "2026-01-29");
    await expect(page.locator("#calendar-list")).toContainText("Najnowszy wynik");
    await respond(0, "Spóźniony wynik", "2026-01-30");
    await app.evaluate(() => globalThis.calendarCalls[1].reject(new Error("Spóźniona awaria")));
    await expect(page.locator("#calendar-list")).toContainText("Najnowszy wynik");
    await expect(page.locator("#calendar-update")).toContainText("Sprawdzono");
    await page.locator("#calendar-open").click();
    await expect.poll(calls).toBe(4);
    await app.evaluate(() => globalThis.calendarCalls[3].reject(new Error("Offline")));
    await expect(page.locator("#calendar-update")).toContainText("To nie oznacza braku premier");
    await page.locator("#calendar-refresh").click();
    await expect.poll(calls).toBe(5);
    await respond(4, "Odzyskana premiera", "2026-01-29");
    await expect(page.locator("#calendar-list")).toContainText("Odzyskana premiera");
    await page.locator(".release-copy a").click();
    assert.deepEqual(await app.evaluate(() => globalThis.openedSources), ["https://www.filmweb.pl/film/Test-2026-1"]);
    await page.locator("#calendar-close").click();
    await expect(page.locator("#city-panel")).toBeVisible();
    const requests = await app.evaluate(() => globalThis.calendarCalls.map(call => ({
      url: call.url, cache: call.options.cache,
    })));
    assert.match(requests[1].url, /premiere\/2026\/2$/);
    assert.match(requests[2].url, /premiere\/2026\/1$/);
    assert.ok(requests.every(request => request.cache === "no-store"));
  } finally {
    await app.close();
  }
});
