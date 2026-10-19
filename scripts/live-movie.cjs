// Exercise a packaged application's real UI and backend against published showtimes.
// node scripts/live-movie.cjs "path/to/app" 2026-10-18 Szczecin Lalka "Helios Outlet Park" 12:15 15:45
const { _electron: electron, expect } = require('@playwright/test');
const path = require('node:path');

async function main() {
  const [root, date, city, movie, cinema, ...times] = process.argv.slice(2);
  if (!root || !date || !city || !movie || !cinema || !times.length)
    throw new Error('Provide app directory, date, city, movie, cinema and expected times.');
  const app = await electron.launch({ executablePath: path.resolve(root, 'CinemaMovieFinder.exe') });
  try {
    const page = await app.firstWindow();
    await page.locator('#city').fill(city);
    await page.locator('#city-form button').click();
    await page.locator('#date').fill(date);
    await page.locator('#date-form button').click();
    const film = page.locator('#movies').getByRole('button', { name: movie, exact: true });
    await expect(film).toBeVisible({ timeout: 300000 });
    await film.click();
    for (const time of times) {
      await expect(page.locator('#screenings').getByRole('button', {
        name: `${time} ${cinema}`, exact: true
      })).toBeVisible();
    }
    console.log(JSON.stringify({ date, city, movie, cinema, verifiedTimes: times,
      displayedScreenings: await page.locator('#screenings button').count() }));
  } finally { await app.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
