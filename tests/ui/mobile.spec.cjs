// Testujemy zbudowany pakiet mobilny; zastępujemy wyłącznie natywne wywołania systemu.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
test.beforeAll(() => execFileSync(process.execPath, ['scripts/mobile.cjs'], { cwd: root }));

async function setup(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.androidBridge = {};
    window.nativeCalls = [];
    window.Capacitor = {
      PluginHeaders: [
        { name: 'CinemaEngine', methods: [{ name: 'request', rtype: 'promise' }, { name: 'cancel', rtype: 'promise' }] },
        { name: 'Browser', methods: [{ name: 'open', rtype: 'promise' }] },
        { name: 'App', methods: [{ name: 'addListener' }, { name: 'exitApp', rtype: 'promise' }] }
      ],
      nativeCallback: (_plugin, _method, _options, callback) => { window.goBack = callback; return '1'; },
      nativePromise: async (plugin, method, options) => {
        window.nativeCalls.push({ plugin, method, options });
        if (plugin !== 'CinemaEngine' || method === 'cancel') return {};
        if (window.failEngine) return { json: JSON.stringify({ error: 'Brak połączenia.' }) };
        const input = JSON.parse(options.json);
        if (input.command === 'detail') return { json: JSON.stringify({ address: 'Żółta 1' }) };
        return { json: JSON.stringify({ city: input.city, screenings: [
          { id: 0, title: 'Film 🎬 Łódź', movieKey: 'film', time: '18:30', cinema: 'Kino', address: '', ticketUrl: 'https://example.org/bilet' }
        ] }) };
      }
    };
  });
  await page.goto(pathToFileURL(path.join(root, 'dist/mobile/index.html')).href);
}

test('mobile bundle bridges search, details, tickets and Android back navigation', async ({ page }) => {
  await setup(page);
  await expect(page.locator('#quit')).toBeHidden();
  await page.locator('#cities button').first().click();
  await page.locator('#today').click();
  await page.getByRole('button', { name: 'Film 🎬 Łódź', exact: true }).click();
  await page.locator('#screenings .choice').click();
  await expect(page.locator('#detail-address')).toHaveText('Żółta 1');
  await page.locator('#ticket').click();
  expect(await page.evaluate(() => nativeCalls.find(call => call.plugin === 'Browser').options.url)).toBe('https://example.org/bilet');
  await page.evaluate(() => goBack());
  await expect(page.locator('#screenings-panel')).toBeVisible();
  const blocked = await page.evaluate(async () => {
    await cinema.cancel();
    try { await cinema.openTicket('https://example.org/bilet'); return false; } catch { return true; }
  });
  expect(blocked).toBe(true);
});

test('native failure remains visible and arbitrary links are rejected', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.failEngine = true; });
  await page.locator('#cities button').first().click();
  await page.locator('#today').click();
  await expect(page.getByRole('alert')).toHaveText('Brak połączenia.');
  await expect(page.locator('#date-panel')).toBeVisible();
  expect(await page.evaluate(async () => {
    for (const url of ['javascript:alert(1)', 'file:///tmp/test', 'https://example.org/other']) {
      try { await cinema.openTicket(url); return false; } catch {}
    }
    return true;
  })).toBe(true);
});

test('mobile movie lookup accepts only films from current results', async ({ page }) => {
  await setup(page);
  await page.locator('#cities button').first().click();
  await page.locator('#today').click();
  await page.locator('.movie-info').click();
  const url = await page.evaluate(() => nativeCalls.find(call => call.plugin === 'Browser').options.url);
  expect(new URL(url).origin).toBe('https://www.google.com');
  expect(new URL(url).searchParams.get('q')).toBe('Film 🎬 Łódź film');
  expect(await page.evaluate(async () => {
    try { await cinema.openMovie('https://example.org'); return false; } catch {}
    await cinema.cancel();
    try { await cinema.openMovie('film'); return false; } catch {}
    return true;
  })).toBe(true);
});
