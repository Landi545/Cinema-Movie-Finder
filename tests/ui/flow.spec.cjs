// Kontrolowane odpowiedzi window.cinema pozwalają testować interfejs bez połączeń sieciowych.
const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const pageUrl = pathToFileURL(path.resolve(__dirname, '../../desktop/ui/index.html')).href;
async function setup(page, mode = 'success') {
  await page.addInitScript(mode => {
    window.requests = [];
    window.cinema = {
      search: async input => {
        window.requests.push(input);
        if (mode === 'error') throw new Error('Brak połączenia. Spróbuj ponownie.');
        if (mode === 'pending') return new Promise(() => {});
        return { city: input.city, unavailableSources: mode === 'partial' || mode === 'unavailable' ? ['Multikino'] : [], screenings: mode === 'empty' || mode === 'unavailable' ? [] : [
          { id: 0, title: 'Zażółć gęślą jaźń', movieKey: 'zazolc gesla jazn', time: '18:30', cinema: 'Kino Łódź', address: '', ticketUrl: 'https://example.org/bilety' },
          { id: 1, title: 'Zażółć gęślą jaźń', movieKey: 'zazolc gesla jazn', time: '20:00', cinema: 'Kino Świat', address: 'Żółta 1', ticketUrl: 'https://example.org/bilety' },
          { id: 2, title: '<img src=x onerror=alert(1)>', movieKey: 'unsafe title', time: '21:00', cinema: 'Kino', address: 'Test', ticketUrl: '' }
        ] };
      },
      detail: async () => ({ address: 'ul. Żółta ąęśćńóźż 1' }),
      openTicket: async url => { window.openedTicket = url; },
      cancel: async () => { window.cancelled = true; }, promote: async () => { window.promoted = true; }, quit: async () => {}
    };
  }, mode);
  await page.goto(pageUrl);
}
test('mouse-only flow preserves Polish letters and original fields', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Łódź', exact: true }).click();
  await page.getByRole('button', { name: /^Dzisiaj/ }).click();
  await expect(page.locator('#movies .choice')).toHaveCount(2);
  await expect(page.locator('#movies img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Zażółć gęślą jaźń', exact: true }).click();
  await expect(page.locator('#screenings .choice')).toHaveCount(2);
  await page.getByRole('button', { name: '18:30 Kino Łódź' }).click();
  await expect(page.locator('#detail-address')).toHaveText('ul. Żółta ąęśćńóźż 1');
  await page.getByRole('button', { name: 'Otwórz bilety' }).click();
  expect(await page.evaluate(() => window.openedTicket)).toBe('https://example.org/bilety');
  await page.getByRole('button', { name: 'Wróć do seansów' }).click();
  await page.getByRole('button', { name: 'Wróć do filmów' }).click();
  await page.getByRole('button', { name: 'Szukaj dalej', exact: true }).click();
  await expect(page.locator('#city-panel')).toBeVisible();
});
test('custom city and date, empty repertory and returning to date', async ({ page }) => {
  await setup(page, 'empty');
  await page.getByLabel('Miasto', { exact: true }).fill('Bielsko-Biała');
  await page.getByRole('button', { name: 'Dalej', exact: false }).click();
  await page.getByLabel('Inna data').fill('2028-02-29');
  await page.getByRole('button', { name: 'Pokaż filmy' }).click();
  await expect(page.locator('#empty')).toBeVisible();
  expect(await page.evaluate(() => window.requests[0])).toEqual({ city: 'Bielsko-Biała', date: '2028-02-29' });
  await page.getByRole('button', { name: 'Zmień datę' }).click();
  await expect(page.locator('#date-panel')).toBeVisible();
});
test('network error returns to usable controls', async ({ page }) => {
  await setup(page, 'error');
  await page.getByRole('button', { name: 'Łódź', exact: true }).click();
  await page.getByRole('button', { name: /^Jutro/ }).click();
  await expect(page.getByRole('alert')).toContainText('Brak połączenia');
  await expect(page.locator('#date-panel')).toBeVisible();
});
test('cancel returns to date and compact window does not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 600 });
  await setup(page, 'pending');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Łódź', exact: true }).click();
  await page.getByRole('button', { name: /^Dzisiaj/ }).click();
  await page.getByRole('button', { name: 'Anuluj pobieranie' }).click();
  await expect(page.locator('#date-panel')).toBeVisible();
  expect(await page.evaluate(() => window.cancelled)).toBe(true);
});

test('source failure is not presented as no screenings', async ({ page }) => {
  await setup(page, 'unavailable');
  await page.getByRole('button', { name: 'Szczecin', exact: true }).click();
  await page.getByRole('button', { name: /^Jutro/ }).click();
  await expect(page.locator('#empty')).toContainText('To nie oznacza braku seansów');
  await expect(page.locator('#status')).toHaveText('Problem z pobieraniem');
});

test('partial source failure keeps usable film results', async ({ page }) => {
  await setup(page, 'partial');
  await page.getByRole('button', { name: 'Szczecin', exact: true }).click();
  await page.getByRole('button', { name: /^Jutro/ }).click();
  await expect(page.locator('#source-warning')).toContainText('Multikino');
  await expect(page.locator('#movies .choice')).toHaveCount(2);
});

test('promotion shortcut opens a ready-to-share post and previous steps are clickable', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Nagłośnij projekt na X' }).click();
  expect(await page.evaluate(() => window.promoted)).toBe(true);
  await page.getByRole('button', { name: 'Warszawa', exact: true }).click();
  await page.getByRole('button', { name: /^Dzisiaj/ }).click();
  await expect(page.locator('#movies-panel')).toBeVisible();
  await page.locator('#steps [data-stage="date"]').click();
  await expect(page.locator('#date-panel')).toBeVisible();
  expect(await page.locator('#steps [data-stage="movies"]').getAttribute('aria-disabled')).toBe('true');
});
